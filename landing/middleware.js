/*
 * Routing Middleware for fhecat.com/admin/mint/: a copy of the mint site on the
 * testnet for the admin panel, together with the arena game its Arena tab
 * plays. Every file under it (the page and its scripts alike) is served only
 * with a signed-in admin session: the cookie api/admin sets, signed with
 * ADMIN_PASSWORD. Anyone else is sent to the sign-in page. `npm run
 * build:admin-copy` in web/ writes the copy.
 *
 * The same site is also open to everyone at fhecat.com/testnet/ (the owner
 * opened it on 17 October 2026 so anyone can try the system), without a
 * session; `npm run build:testnet-copy` writes that one, and no middleware
 * touches it. To close it again, delete landing/testnet/.
 */
import { next } from '@vercel/functions';

export const config = { matcher: ['/admin/mint', '/admin/mint/:path*'] };

const COOKIE = 'fhecat_admin';
const SESSION = new RegExp(`(?:^|;\\s*)${COOKIE}=(\\d{1,12})\\.([\\w-]{1,64})`);
const utf8 = new TextEncoder();

/** The cookie's signature, as api/admin makes it: HMAC-SHA256, base64url. */
async function sign(exp, key) {
  const hmac = await crypto.subtle.importKey('raw', utf8.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', hmac, utf8.encode(`fhecat-admin.${exp}`)));
  return btoa(String.fromCharCode(...mac)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Constant-time string comparison. */
function same(a, b) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i % (b.length || 1));
  return diff === 0;
}

export default async function middleware(request) {
  const key = process.env.ADMIN_PASSWORD || '';
  const m = SESSION.exec(request.headers.get('cookie') || '');
  if (key.length >= 12 && m && Number(m[1]) > Date.now() / 1000 && same(m[2], await sign(m[1], key))) {
    return next({ headers: { 'Cache-Control': 'private, no-cache', 'X-Robots-Tag': 'noindex, nofollow' } });
  }
  return new Response(null, { status: 302, headers: { Location: '/admin?next=mint', 'Cache-Control': 'no-store' } });
}
