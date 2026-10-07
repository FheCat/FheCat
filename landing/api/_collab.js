/*
 * Shared by api/collab.js (community managers) and api/admin.js (the review).
 * The leading underscore keeps Vercel from serving this file as an endpoint.
 *
 * A collab is one community (a DAO, a guild, an alpha group...) asking for
 * allowlist spots. Its manager fills in the application and signs it with a
 * wallet. The team approves it with a number of spots and a deadline; the
 * manager then raffles the spots in a post on X, adds the winners' wallets
 * and submits them, with the post's link, before the deadline.
 */

export const KINDS = { dao: 'DAO', guild: 'Guild', alpha: 'Alpha group', nft: 'NFT project', other: 'Other' };
export const ROLES = { founder: 'Founder', cm: 'Community manager', mod: 'Moderator', other: 'Other' };
export const STATUSES = ['pending', 'approved', 'rejected'];
/** Communities one manager wallet can apply with. */
export const MAX_COLLABS = 5;
export const MAX_SPOTS = 500;
/** Longest submission window the review can give, in hours (30 days). */
export const MAX_HOURS = 720;

const HANDLE = /^[A-Za-z0-9_]{1,15}$/;
const WALLET = /^0x[0-9a-fA-F]{40}$/;
const INVITE = /^(?:https?:\/\/)?(?:www\.)?(?:discord\.gg|discord(?:app)?\.com\/invite)\/([A-Za-z0-9-]{2,32})\/?$/i;
const POST = /^(?:https?:\/\/)?(?:www\.|mobile\.)?(?:x|twitter)\.com\/(?:([A-Za-z0-9_]{1,15})|i(?:\/web)?)\/status(?:es)?\/(\d{1,20})(?:[/?#].*)?$/i;

let ready;
/** Creates the collabs table the first time it is needed; safe to call on every request. */
export function ensureSchema(sql) {
  ready ??= (async () => {
    const run = async (statement) => {
      try {
        await statement();
      } catch (err) {
        // Two cold starts creating the table at once: the loser sees it already there.
        if (!/already exists|duplicate key/i.test(String(err && err.message))) throw err;
      }
    };
    await run(
      () => sql`
        CREATE TABLE IF NOT EXISTS collabs (
          id bigserial PRIMARY KEY,
          created_at timestamptz NOT NULL DEFAULT now(),
          manager text NOT NULL,
          name text NOT NULL,
          kind text NOT NULL,
          x_handle text NOT NULL,
          discord text NOT NULL DEFAULT '',
          website text NOT NULL DEFAULT '',
          members integer NOT NULL DEFAULT 0,
          requested integer NOT NULL DEFAULT 0,
          contact_x text NOT NULL,
          contact_discord text NOT NULL DEFAULT '',
          role text NOT NULL DEFAULT '',
          pitch text NOT NULL DEFAULT '',
          status text NOT NULL DEFAULT 'pending',
          spots integer NOT NULL DEFAULT 0,
          deadline timestamptz,
          submitted_at timestamptz,
          reviewed_at timestamptz,
          winners jsonb NOT NULL DEFAULT '[]'::jsonb,
          tweet text NOT NULL DEFAULT ''
        )`
    );
    // Added after the first release: the link to the raffle post on X.
    await run(() => sql`ALTER TABLE collabs ADD COLUMN IF NOT EXISTS tweet text NOT NULL DEFAULT ''`);
    await run(() => sql`CREATE UNIQUE INDEX IF NOT EXISTS collabs_x_handle ON collabs (lower(x_handle))`);
    await run(() => sql`CREATE INDEX IF NOT EXISTS collabs_manager ON collabs (manager)`);
  })().catch((err) => {
    ready = undefined;
    throw err;
  });
  return ready;
}

/** One line of plain text: control characters and runs of spaces collapsed. */
function line(raw, max) {
  return String(raw ?? '')
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/** "@Name", "x.com/Name" or "https://twitter.com/Name" -> "Name"; null if it is not a handle. */
export function handleOf(raw) {
  const s = String(raw ?? '')
    .trim()
    .replace(/^https?:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\//i, '')
    .replace(/^(?:x|twitter)\.com\//i, '')
    .replace(/^@/, '')
    .replace(/[/?#].*$/, '');
  return HANDLE.test(s) ? s : null;
}

/** A Discord invite as https://discord.gg/<code>; "" when empty, null when it is not an invite. */
function inviteOf(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  const m = INVITE.exec(s);
  return m ? `https://discord.gg/${m[1]}` : null;
}

/** An http(s) address; "" when empty, null when it is not one. */
function siteOf(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  try {
    const url = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    return /^https?:$/.test(url.protocol) && url.hostname.includes('.') && url.href.length <= 200 ? url.href : null;
  } catch {
    return null;
  }
}

/** A post on X as https://x.com/<handle>/status/<id>; "" when empty, null when it is not a post link. */
export function postOf(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  const m = s.length <= 300 && POST.exec(s);
  return m ? `https://x.com/${m[1] || 'i'}/status/${m[2]}` : null;
}

function whole(raw, min, max) {
  const n = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw;
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

/** Checks an application. Returns { value } or { error, field }. */
export function readApplication(body) {
  const b = body || {};
  const name = line(b.name, 80);
  if (name.length < 2 || name.length > 40) return { error: 'Give your community a name (2-40 characters).', field: 'name' };
  const kind = String(b.kind || '');
  if (!KINDS[kind]) return { error: 'Pick what kind of community it is.', field: 'kind' };
  const x = handleOf(b.x);
  if (!x) return { error: "Your community's X handle doesn't look right.", field: 'x' };
  const discord = inviteOf(b.discord);
  if (discord === null) return { error: 'Use a Discord invite link, like discord.gg/yourcommunity.', field: 'discord' };
  const website = siteOf(b.website);
  if (website === null) return { error: "That website address doesn't look right.", field: 'website' };
  const members = whole(b.members, 1, 10_000_000);
  if (members === null) return { error: 'Roughly how many members does it have?', field: 'members' };
  const requested = whole(b.requested, 1, MAX_SPOTS);
  if (requested === null) return { error: `Ask for 1 to ${MAX_SPOTS} spots.`, field: 'requested' };
  const contactX = handleOf(b.contactX);
  if (!contactX) return { error: "Your own X handle doesn't look right.", field: 'contactX' };
  const contactDiscord = line(b.contactDiscord, 40);
  if (contactDiscord && !/^[A-Za-z0-9_.]{2,32}$/.test(contactDiscord)) return { error: "That Discord username doesn't look right.", field: 'contactDiscord' };
  const role = String(b.role || '');
  if (!ROLES[role]) return { error: 'Pick your role in the community.', field: 'role' };
  const pitch = line(b.pitch, 600);
  if (pitch.length < 10) return { error: 'Tell us a little about your community (at least 10 characters).', field: 'pitch' };
  return { value: { name, kind, x, discord, website, members, requested, contactX, contactDiscord, role, pitch } };
}

/**
 * Checks a winners list against the collab's spots. Empty rows are skipped.
 * Returns { winners } or { error, row } (row: the index in the list sent).
 */
export function readWinners(list, spots) {
  if (!Array.isArray(list) || list.length > MAX_SPOTS) return { error: 'Send the winners as a list.' };
  const winners = [];
  const seen = new Set();
  for (let i = 0; i < list.length; i++) {
    const item = list[i] || {};
    const name = line(item.name, 64);
    const wallet = String(item.wallet ?? '').trim();
    if (!name && !wallet) continue;
    if (!name) return { error: `Row ${i + 1}: add the winner's name.`, row: i };
    if (name.length > 40) return { error: `Row ${i + 1}: keep the name under 40 characters.`, row: i };
    if (!WALLET.test(wallet)) return { error: `Row ${i + 1}: that wallet doesn't look right (0x and 40 characters).`, row: i };
    const lower = wallet.toLowerCase();
    if (seen.has(lower)) return { error: `Row ${i + 1}: this wallet is already on your list.`, row: i };
    seen.add(lower);
    winners.push({ name, wallet: lower });
  }
  if (winners.length > spots) return { error: `You have ${spots} spots, and the list has ${winners.length} wallets.` };
  return { winners };
}

const iso = (t) => (t ? new Date(t).toISOString() : null);

/** A collab as its manager sees it. */
export function managerView(r) {
  return {
    id: Number(r.id),
    name: r.name,
    kind: r.kind,
    x: r.x_handle,
    discord: r.discord,
    website: r.website,
    members: r.members,
    requested: r.requested,
    contactX: r.contact_x,
    status: r.status,
    spots: r.spots,
    deadline: iso(r.deadline),
    submittedAt: iso(r.submitted_at),
    createdAt: iso(r.created_at),
    winners: Array.isArray(r.winners) ? r.winners : [],
    tweet: r.tweet || ''
  };
}

/** A collab as the review sees it: everything. */
export function adminView(r) {
  return {
    ...managerView(r),
    manager: r.manager,
    contactDiscord: r.contact_discord,
    role: r.role,
    pitch: r.pitch,
    reviewedAt: iso(r.reviewed_at)
  };
}
