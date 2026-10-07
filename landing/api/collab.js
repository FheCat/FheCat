/*
 * /api/collab: community managers' side of fhecat.com/collab.
 *
 * Managers sign in with a wallet: the server hands out a short message with
 * a signed nonce, the wallet signs it (free, no transaction) and the server
 * checks the signature and sets a 7-day session cookie. Cookies and nonces
 * are signed with a key derived from ADMIN_PASSWORD, so changing that
 * password signs managers out too.
 *
 *   GET  ?challenge=0x...                      the message to sign
 *   POST {action: 'signin', address, token, signature}
 *   POST {action: 'signout'}
 *   GET                                        my collabs
 *   POST {action: 'apply', ...}                a new community (pending review)
 *   POST {action: 'save', id, winners}         winners so far (until submitted)
 *   POST {action: 'submit', id, winners}       final winners; locks the list
 */
import crypto from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { getAddress, isAddress, verifyMessage } from 'viem';
import { MAX_COLLABS, ensureSchema, managerView, readApplication, readWinners } from './_collab.js';

const COOKIE = 'fhecat_collab';
const SESSION_TTL = 7 * 24 * 60 * 60; // seconds
const CHALLENGE_TTL = 10 * 60 * 1000; // ms
const SESSION = new RegExp(`(?:^|;\\s*)${COOKIE}=(0x[0-9a-f]{40})\\.(\\d{1,12})\\.([\\w-]{1,64})`);

const keyOf = (password) => crypto.createHmac('sha256', password).update('fhecat-collab-v1').digest();
const mac = (key, text) => crypto.createHmac('sha256', key).update(text).digest('base64url');
/** Constant-time string comparison. */
function same(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/** The exact text a manager's wallet signs. */
function challengeText(address, nonce, issued) {
  return [
    'fhecat.com wants you to sign in to FheCat Collab.',
    '',
    'Signing proves this wallet is yours. It is free and sends no transaction.',
    '',
    `Wallet: ${address}`,
    `Nonce: ${nonce}`,
    `Issued at: ${new Date(issued).toISOString()}`
  ].join('\n');
}

/** The signed-in wallet (lowercase), or null. */
function sessionOf(req, key) {
  const m = SESSION.exec(req.headers.cookie || '');
  if (!m || Number(m[2]) <= Date.now() / 1000) return null;
  return same(m[3], mac(key, `session.${m[1]}.${m[2]}`)) ? m[1] : null;
}

function setSession(res, value, maxAge) {
  res.setHeader('Set-Cookie', `${COOKIE}=${value}; Path=/api/collab; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`);
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

async function state(sql, wallet) {
  await ensureSchema(sql);
  const rows = await sql`SELECT * FROM collabs WHERE manager = ${wallet} ORDER BY id`;
  return { wallet, now: new Date().toISOString(), collabs: rows.map(managerView) };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const password = process.env.ADMIN_PASSWORD || '';
  if (password.length < 12 || !process.env.DATABASE_URL) return res.status(503).json({ error: 'Collabs are not open yet.' });
  const key = keyOf(password);
  const sql = neon(process.env.DATABASE_URL);

  try {
    if (req.method === 'GET') {
      const query = req.query || {};
      if (query.challenge !== undefined) {
        const address = String(query.challenge);
        if (!isAddress(address, { strict: false })) return res.status(400).json({ error: 'That is not a wallet address.' });
        const lower = address.toLowerCase();
        const nonce = crypto.randomBytes(8).toString('hex');
        const issued = Date.now();
        return res.status(200).json({
          message: challengeText(getAddress(lower), nonce, issued),
          token: `${nonce}.${issued}.${mac(key, `challenge.${lower}.${nonce}.${issued}`)}`
        });
      }
      const wallet = sessionOf(req, key);
      if (!wallet) return res.status(401).json({ error: 'Sign in with your wallet first.' });
      return res.status(200).json(await state(sql, wallet));
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return res.status(405).json({ error: 'Use GET or POST.' });
    }
    if (!sameOrigin(req)) return res.status(403).json({ error: 'Not from this site.' });
    if (!/^application\/json\b/i.test(req.headers['content-type'] || '')) return res.status(415).json({ error: 'Send JSON.' });
    const body = req.body && typeof req.body === 'object' ? req.body : {};

    if (body.action === 'signin') {
      const address = String(body.address || '');
      if (!isAddress(address, { strict: false })) return res.status(400).json({ error: 'That is not a wallet address.' });
      const lower = address.toLowerCase();
      const [nonce, issued, tag] = String(body.token || '').split('.');
      const fresh = /^\d{13}$/.test(issued || '') && Date.now() - Number(issued) < CHALLENGE_TTL && Number(issued) < Date.now() + 60_000;
      if (!/^[0-9a-f]{16}$/.test(nonce || '') || !fresh || !same(tag, mac(key, `challenge.${lower}.${nonce}.${issued}`))) {
        return res.status(400).json({ error: 'That sign-in expired. Try again.' });
      }
      let valid = false;
      try {
        valid = await verifyMessage({ address: getAddress(lower), message: challengeText(getAddress(lower), nonce, Number(issued)), signature: body.signature });
      } catch {
        valid = false;
      }
      if (!valid) return res.status(401).json({ error: "That signature doesn't match the wallet. Use a regular wallet such as MetaMask or Rabby." });
      const exp = Math.floor(Date.now() / 1000) + SESSION_TTL;
      setSession(res, `${lower}.${exp}.${mac(key, `session.${lower}.${exp}`)}`, SESSION_TTL);
      return res.status(200).json(await state(sql, lower));
    }
    if (body.action === 'signout') {
      setSession(res, '', 0);
      return res.status(200).json({ ok: true });
    }

    const wallet = sessionOf(req, key);
    if (!wallet) return res.status(401).json({ error: 'Sign in with your wallet first.' });

    if (body.action === 'apply') {
      await ensureSchema(sql);
      // Bots fill every field; people never see this one.
      if (body.company) return res.status(200).json(await state(sql, wallet));
      const app = readApplication(body);
      if (app.error) return res.status(400).json(app);
      const [{ n }] = await sql`SELECT count(*)::int AS n FROM collabs WHERE manager = ${wallet}`;
      if (n >= MAX_COLLABS) return res.status(409).json({ error: `One wallet can apply with up to ${MAX_COLLABS} communities.` });
      const v = app.value;
      try {
        await sql`
          INSERT INTO collabs (manager, name, kind, x_handle, discord, website, members, requested, contact_x, contact_discord, role, pitch)
          VALUES (${wallet}, ${v.name}, ${v.kind}, ${v.x}, ${v.discord}, ${v.website}, ${v.members}, ${v.requested}, ${v.contactX}, ${v.contactDiscord}, ${v.role}, ${v.pitch})`;
      } catch (err) {
        if (err && (err.code === '23505' || /duplicate key/i.test(String(err.message)))) {
          return res.status(409).json({ error: `@${v.x} has already applied. DM @FheCat on X if that wasn't you.`, field: 'x' });
        }
        throw err;
      }
      return res.status(200).json(await state(sql, wallet));
    }

    if (body.action === 'save' || body.action === 'submit') {
      await ensureSchema(sql);
      const id = Number(body.id);
      if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Pick one of your collabs.' });
      const [row] = await sql`SELECT * FROM collabs WHERE id = ${id} AND manager = ${wallet}`;
      if (!row) return res.status(404).json({ error: 'That collab is not yours.' });
      if (row.status !== 'approved') return res.status(409).json({ error: 'This collab is not approved yet.' });
      if (row.submitted_at) return res.status(409).json({ error: 'These wallets are already submitted.' });
      const list = readWinners(body.winners, row.spots);
      if (list.error) return res.status(400).json(list);
      const submit = body.action === 'submit';
      if (submit && !list.winners.length) return res.status(400).json({ error: 'Add at least one winner first.' });
      const saved = await sql`
        UPDATE collabs
        SET winners = ${JSON.stringify(list.winners)}::jsonb,
            submitted_at = CASE WHEN ${submit}::boolean THEN now() ELSE NULL END
        WHERE id = ${id} AND manager = ${wallet} AND status = 'approved' AND submitted_at IS NULL AND deadline > now()
        RETURNING id`;
      if (!saved.length) return res.status(409).json({ error: 'The time to submit is over. DM @FheCat on X if you need more time.' });
      return res.status(200).json(await state(sql, wallet));
    }

    return res.status(400).json({ error: 'Unknown action.' });
  } catch (err) {
    console.error('collab failed', err);
    return res.status(500).json({ error: 'Something went wrong on our side.' });
  }
}
