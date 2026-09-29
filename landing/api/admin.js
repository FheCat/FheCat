/*
 * /api/admin: the waitlist admin behind fhecat.com/admin.
 *
 * Signing in with ADMIN_PASSWORD (a Vercel env var) sets a 12-hour session
 * cookie. The cookie is signed with that same password, so changing the
 * password signs every session out.
 *
 *   POST {action: 'login', password}           sign in
 *   POST {action: 'logout'}                    sign out
 *   GET  ?status=&q=&after=&limit=&order=      entries (keyset paging by id) + counts
 *   POST {action: 'status', ids: [...], status} approve, reject, or back to pending
 *
 * Exports are built in the browser from the GET pages, so there is no size cap.
 */
import crypto from 'node:crypto';
import { neon } from '@neondatabase/serverless';

const COOKIE = 'fhecat_admin';
const TTL = 12 * 60 * 60; // seconds
const STATUSES = ['pending', 'approved', 'rejected'];

const digest = (s) => crypto.createHash('sha256').update(String(s)).digest();
/** Constant-time string comparison. */
const same = (a, b) => crypto.timingSafeEqual(digest(a), digest(b));
const sign = (exp, key) => crypto.createHmac('sha256', key).update(`fhecat-admin.${exp}`).digest('base64url');

function signedIn(req, key) {
  const m = new RegExp(`(?:^|;\\s*)${COOKIE}=(\\d{1,12})\\.([\\w-]{1,64})`).exec(req.headers.cookie || '');
  return !!m && Number(m[1]) > Date.now() / 1000 && same(m[2], sign(m[1], key));
}

function session(res, value, maxAge) {
  res.setHeader('Set-Cookie', `${COOKIE}=${value}; Path=/api/admin; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`);
}

/** Browsers send Origin on every POST; it has to be this site. */
function sameOrigin(req) {
  if (!req.headers.origin) return true;
  try {
    return new URL(req.headers.origin).host === req.headers.host;
  } catch {
    return false;
  }
}

async function counts(sql) {
  const out = { total: 0, pending: 0, approved: 0, rejected: 0, today: 0 };
  const rows = await sql`
    SELECT status, count(*)::int AS n, (count(*) FILTER (WHERE created_at > now() - interval '24 hours'))::int AS today
    FROM waitlist GROUP BY status`;
  for (const r of rows) {
    out[r.status] = r.n;
    out.total += r.n;
    out.today += r.today;
  }
  return out;
}

function entry(r) {
  return {
    id: Number(r.id),
    handle: r.handle,
    wallet: r.wallet.toLowerCase(),
    post: r.post_url,
    reply: r.reply_url,
    card: r.card_id,
    status: r.status,
    at: new Date(r.created_at).toISOString()
  };
}

async function list(sql, query) {
  const status = STATUSES.includes(query.status) ? query.status : null;
  const term = String(query.q || '').trim().replace(/^@/, '').slice(0, 64);
  const like = term ? `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
  const after = /^\d{1,15}$/.test(query.after || '') ? query.after : null;
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 100, 1), 1000);

  const rows =
    query.order === 'asc'
      ? await sql`
          SELECT id, handle, wallet, post_url, reply_url, card_id, status, created_at FROM waitlist
          WHERE (${status}::text IS NULL OR status = ${status})
            AND (${like}::text IS NULL OR handle ILIKE ${like} OR wallet ILIKE ${like} OR card_id ILIKE ${like})
            AND (${after}::bigint IS NULL OR id > ${after}::bigint)
          ORDER BY id ASC LIMIT ${limit + 1}`
      : await sql`
          SELECT id, handle, wallet, post_url, reply_url, card_id, status, created_at FROM waitlist
          WHERE (${status}::text IS NULL OR status = ${status})
            AND (${like}::text IS NULL OR handle ILIKE ${like} OR wallet ILIKE ${like} OR card_id ILIKE ${like})
            AND (${after}::bigint IS NULL OR id < ${after}::bigint)
          ORDER BY id DESC LIMIT ${limit + 1}`;

  const more = rows.length > limit;
  const entries = rows.slice(0, limit).map(entry);
  return { entries, next: more ? entries[entries.length - 1].id : null };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const key = process.env.ADMIN_PASSWORD || '';
  if (key.length < 12 || !process.env.DATABASE_URL) return res.status(503).json({ error: 'The admin is not set up yet.' });
  const sql = neon(process.env.DATABASE_URL);

  try {
    if (req.method === 'GET') {
      if (!signedIn(req, key)) return res.status(401).json({ error: 'Sign in first.' });
      const query = req.query || {};
      const [page, all] = await Promise.all([list(sql, query), query.after ? null : counts(sql)]);
      return res.status(200).json(all ? { ...page, counts: all } : page);
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return res.status(405).json({ error: 'Use GET or POST.' });
    }
    if (!sameOrigin(req)) return res.status(403).json({ error: 'Not from this site.' });
    if (!/^application\/json\b/i.test(req.headers['content-type'] || '')) return res.status(415).json({ error: 'Send JSON.' });
    const body = req.body && typeof req.body === 'object' ? req.body : {};

    if (body.action === 'login') {
      if (!same(body.password || '', key)) {
        await new Promise((r) => setTimeout(r, 800)); // slows down guessing
        return res.status(401).json({ error: 'Wrong password.' });
      }
      const exp = Math.floor(Date.now() / 1000) + TTL;
      session(res, `${exp}.${sign(exp, key)}`, TTL);
      return res.status(200).json({ ok: true });
    }
    if (body.action === 'logout') {
      session(res, '', 0);
      return res.status(200).json({ ok: true });
    }

    if (!signedIn(req, key)) return res.status(401).json({ error: 'Sign in first.' });
    if (body.action === 'status') {
      const ids = Array.isArray(body.ids) ? body.ids.map(Number).filter((n) => Number.isSafeInteger(n) && n > 0) : [];
      if (!STATUSES.includes(body.status) || !ids.length || ids.length > 1000) {
        return res.status(400).json({ error: 'Pick up to 1000 entries and a status.' });
      }
      const done = await sql`
        UPDATE waitlist SET status = ${body.status}
        WHERE id = ANY(${`{${ids.join(',')}}`}::bigint[])
        RETURNING id`;
      return res.status(200).json({ ok: true, ids: done.map((r) => Number(r.id)), status: body.status, counts: await counts(sql) });
    }
    return res.status(400).json({ error: 'Unknown action.' });
  } catch (err) {
    console.error('admin failed', err);
    return res.status(500).json({ error: 'Something went wrong on our side.' });
  }
}
