/*
 * POST /api/waitlist: adds one entry to the FheCat waitlist (Neon Postgres).
 *
 * The page walks people through: follow @FheCat, make their card, post it,
 * reply to the launch post with it, add a wallet. X can't be checked from
 * here without its paid API, so the two post links are stored and every
 * entry is reviewed by hand before the mint. What this endpoint does check:
 * the handle and wallet look right, both links are posts by that same handle,
 * and nothing is registered twice.
 */
import { neon } from '@neondatabase/serverless';

const HANDLE = /^[A-Za-z0-9_]{1,15}$/;
const WALLET = /^0x[0-9a-fA-F]{40}$/;
const STATUS = /^https?:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})\/status\/(\d{1,25})(?:[/?#].*)?$/i;

/** FNV-1a of the lowercase handle; must match cardId() in js/wlcard.js. */
function cardId(handle) {
  let h = 0x811c9dc5;
  for (const ch of handle.toLowerCase()) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return '0x' + h.toString(16).toUpperCase().padStart(8, '0');
}

/** A post link by `handle`, normalised to https://x.com/<handle>/status/<id>. */
function postBy(handle, raw) {
  const m = STATUS.exec(String(raw || '').trim());
  if (!m || m[1].toLowerCase() !== handle.toLowerCase()) return null;
  return { id: m[2], url: `https://x.com/${m[1]}/status/${m[2]}` };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Use POST.' });
  }
  const body = req.body && typeof req.body === 'object' ? req.body : {};

  // Bots fill every field; people never see this one.
  if (body.website) return res.status(200).json({ ok: true });

  const handle = String(body.handle || '').trim().replace(/^@/, '');
  const wallet = String(body.wallet || '').trim();
  if (!HANDLE.test(handle)) return res.status(400).json({ error: "That X handle doesn't look right.", field: 'handle' });
  if (!WALLET.test(wallet)) return res.status(400).json({ error: 'Enter an EVM wallet address (0x followed by 40 characters).', field: 'wallet' });

  const post = postBy(handle, body.post);
  if (!post) return res.status(400).json({ error: `The card post must be a link to a post by @${handle}.`, field: 'post' });
  const reply = postBy(handle, body.reply);
  if (!reply) return res.status(400).json({ error: `The reply must be a link to a reply by @${handle}.`, field: 'reply' });
  if (post.id === reply.id) return res.status(400).json({ error: 'The card post and the reply are the same link.', field: 'reply' });

  if (!process.env.DATABASE_URL) return res.status(503).json({ error: 'The waitlist is not open yet.' });

  try {
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`
      INSERT INTO waitlist (handle, wallet, post_url, reply_url, card_id)
      VALUES (${handle}, ${wallet}, ${post.url}, ${reply.url}, ${cardId(handle)})
      RETURNING id`;
    return res.status(200).json({ ok: true, entry: Number(rows[0].id), cardId: cardId(handle) });
  } catch (err) {
    if (err && err.code === '23505') {
      const what = /handle/.test(err.constraint || '')
        ? `@${handle} is already on the waitlist.`
        : /wallet/.test(err.constraint || '')
          ? 'This wallet is already on the waitlist.'
          : 'One of these links was already used for the waitlist.';
      return res.status(409).json({ error: what });
    }
    console.error('waitlist insert failed', err);
    return res.status(500).json({ error: 'Something went wrong on our side. Try again in a minute.' });
  }
}
