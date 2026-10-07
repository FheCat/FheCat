/*
 * /api/admin: the waitlist admin behind fhecat.com/admin.
 *
 * Signing in with ADMIN_PASSWORD (a Vercel env var) sets a 12-hour session
 * cookie. The cookie is signed with that same password, so changing the
 * password signs every session out. The same session opens the testnet mint
 * copy at /admin/mint/ (see middleware.js).
 *
 *   POST {action: 'login', password}           sign in
 *   POST {action: 'logout'}                    sign out
 *   GET  ?status=&q=&after=&limit=&order=      entries (keyset paging by id) + counts
 *   POST {action: 'status', ids: [...], status} approve, reject, or back to pending
 *   GET  ?view=collabs                         every collab (community applications) + counts
 *   POST {action: 'collab', id, status, spots?, hours?, reopen?}
 *                                              approve with spots and a deadline `hours` from now,
 *                                              reject, or back to pending; `reopen` unlocks a submitted list
 *
 * Exports are built in the browser from the GET pages, so there is no size cap.
 */
import crypto from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { MAX_HOURS, MAX_SPOTS, STATUSES as COLLAB_STATUSES, adminView, ensureSchema } from './_collab.js';

const COOKIE = 'fhecat_admin';
const TTL = 12 * 60 * 60; // seconds
const STATUSES = ['pending', 'approved', 'rejected'];

const digest = (s) => crypto.createHash('sha256').update(String(s)).digest();
/** Constant-time string comparison. */
const same = (a, b) => crypto.timingSafeEqual(digest(a), digest(b));
const sign = (exp, key) => crypto.createHmac('sha256', key).update(`fhecat-admin.${exp}`).digest('base64url');

/** The session cookie's expiry and signature, or null unless it is valid. */
function sessionOf(req, key) {
  const m = new RegExp(`(?:^|;\\s*)${COOKIE}=(\\d{1,12})\\.([\\w-]{1,64})`).exec(req.headers.cookie || '');
  return m && Number(m[1]) > Date.now() / 1000 && same(m[2], sign(m[1], key)) ? { exp: Number(m[1]), sig: m[2] } : null;
}

const signedIn = (req, key) => sessionOf(req, key) !== null;

/** Path=/ so the testnet mint copy under /admin/mint/ sees the session too (middleware.js checks it there). */
function session(res, value, maxAge) {
  const cookies = [`${COOKIE}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`];
  // Sessions from before the mint copy lived on Path=/api/admin; signing out ends those too.
  if (!maxAge) cookies.push(`${COOKIE}=; Path=/api/admin; Max-Age=0; HttpOnly; Secure; SameSite=Strict`);
  res.setHeader('Set-Cookie', cookies);
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

async function collabs(sql) {
  await ensureSchema(sql);
  const rows = (await sql`SELECT * FROM collabs ORDER BY id DESC LIMIT 2000`).map(adminView);
  const counts = { total: rows.length, pending: 0, approved: 0, rejected: 0, submitted: 0 };
  for (const c of rows) {
    counts[c.status] += 1;
    if (c.status === 'approved' && c.submittedAt) counts.submitted += 1;
  }
  return { now: new Date().toISOString(), collabs: rows, counts };
}

/** Approve (spots + a deadline `hours` from now), reject or send back to pending one collab. */
async function reviewCollab(sql, body, res) {
  await ensureSchema(sql);
  const id = Number(body.id);
  const status = String(body.status || '');
  if (!Number.isSafeInteger(id) || id < 1 || !COLLAB_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Pick a collab and a status.' });
  }
  const [cur] = await sql`SELECT * FROM collabs WHERE id = ${id}`;
  if (!cur) return res.status(404).json({ error: 'No such collab.' });

  let rows;
  if (status === 'approved') {
    const spots = Number(body.spots);
    const hours = Number(body.hours);
    if (!Number.isInteger(spots) || spots < 1 || spots > MAX_SPOTS) return res.status(400).json({ error: `Give 1 to ${MAX_SPOTS} spots.` });
    if (!Number.isInteger(hours) || hours < 1 || hours > MAX_HOURS) return res.status(400).json({ error: `Give 1 to ${MAX_HOURS} hours to submit.` });
    const saved = Array.isArray(cur.winners) ? cur.winners.length : 0;
    if (spots < saved) return res.status(400).json({ error: `${saved} wallets are already on their list; give at least ${saved} spots.` });
    rows = await sql`
      UPDATE collabs
      SET status = 'approved', spots = ${spots}, deadline = now() + (${hours}::int * interval '1 hour'), reviewed_at = now(),
          submitted_at = CASE WHEN ${Boolean(body.reopen)}::boolean THEN NULL ELSE submitted_at END
      WHERE id = ${id}
      RETURNING *`;
  } else {
    rows = await sql`UPDATE collabs SET status = ${status}, reviewed_at = now() WHERE id = ${id} RETURNING *`;
  }
  return res.status(200).json({ ok: true, collab: adminView(rows[0]) });
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const key = process.env.ADMIN_PASSWORD || '';
  if (key.length < 12 || !process.env.DATABASE_URL) return res.status(503).json({ error: 'The admin is not set up yet.' });
  const sql = neon(process.env.DATABASE_URL);

  try {
    if (req.method === 'GET') {
      const s = sessionOf(req, key);
      if (!s) return res.status(401).json({ error: 'Sign in first.' });
      // Re-set on Path=/, so a session from before the mint copy opens it too.
      session(res, `${s.exp}.${s.sig}`, s.exp - Math.floor(Date.now() / 1000));
      const query = req.query || {};
      if (query.view === 'collabs') return res.status(200).json(await collabs(sql));
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
    if (body.action === 'collab') return await reviewCollab(sql, body, res);
    return res.status(400).json({ error: 'Unknown action.' });
  } catch (err) {
    console.error('admin failed', err);
    return res.status(500).json({ error: 'Something went wrong on our side.' });
  }
}
