# fhecat.com (landing)

The public site at [fhecat.com](https://fhecat.com): a static pixel site plus a
small set of Vercel serverless functions backed by a Neon Postgres database.
No build step — the HTML, CSS and JS are served as-is. The mint site itself
lives in [`../web/`](../web); this package hosts the marketing pages, the
waitlist, the community collab flow and the admin panel, and serves two copies
of the mint site (see [Served copies of the mint site](#served-copies-of-the-mint-site)).

## Pages

| Path | File | What it is |
|---|---|---|
| `/` | `index.html` | Landing page |
| `/waitlist` | `waitlist.html` | Waitlist sign-up (follow + post on X, add a wallet) |
| `/collab` | `collab.html` | Community collab applications (wallet sign-in) |
| `/admin` | `admin.html` | Waitlist and collab review (password sign-in) |
| `/testnet/` | `testnet/` | Public copy of the mint site, open to everyone |
| `/admin/mint/` | `admin/mint/` | Admin-only copy of the mint site (gated by `middleware.js`) |

## API (Vercel functions)

Each file in `api/` is a serverless function. Files whose names start with an
underscore are shared helpers and are **not** served as endpoints.

| Endpoint | File | Purpose |
|---|---|---|
| `POST /api/waitlist` | `api/waitlist.js` | Add one entry to the waitlist. Validates the X handle, wallet and post links; every entry is reviewed by hand before the mint. |
| `/api/collab` | `api/collab.js` | Community managers' side: apply, sign in with a wallet (free EIP-191 signature, 7-day session), save and submit raffle winners. |
| `/api/admin` | `api/admin.js` | Admin side: password sign-in (12-hour session), review the waitlist and collabs, open/close collab applications, and read the Blind Arena from the chain. |
| — | `api/_collab.js` | Shared collab logic and constants used by both `collab.js` and `admin.js`. |
| — | `api/_arena.js` | Reads the testnet Blind Arena on-chain (read-only RPC) for the admin's Arena tab. |

Sessions are cookies signed with HMAC-SHA256 using a key derived from
`ADMIN_PASSWORD`, so changing that password invalidates every session. The
admin session cookie also unlocks `/admin/mint/` through `middleware.js`.

## Environment variables

Set these in the Vercel project settings.

| Variable | Required | Used by | Notes |
|---|---|---|---|
| `DATABASE_URL` | Yes | waitlist, collab, admin | Neon Postgres connection string. Tables are created on first use. |
| `ADMIN_PASSWORD` | Yes | admin, collab, `middleware.js` | Admin sign-in password and the key the session/nonce signatures are derived from. Use at least 12 characters. |
| `SEPOLIA_RPC_URL` | No | `api/_arena.js` | Ethereum Sepolia RPC for the admin's read-only arena view. Falls back to a public endpoint if unset. |

No private keys or wallet secrets are used here: the functions only read the
chain over a public RPC and read/write the Postgres tables. The mint, peek,
reveal and arena transactions are signed in the visitor's own wallet on the
mint site.

## Local development

```bash
cd landing
npm install            # @neondatabase/serverless, @vercel/functions, viem
vercel dev             # run the static site and the functions locally
```

Point `DATABASE_URL` at a Neon database and set `ADMIN_PASSWORD` in a local
`.env` (git-ignored) to exercise the waitlist, collab and admin flows.

## Deploy

Deployed on Vercel from this directory. `vercel.json` configures clean URLs, a
redirect from the `*.vercel.app` host to `fhecat.com`, and security headers
(`noindex` and a strict Content-Security-Policy on the admin surfaces,
`X-Frame-Options` on the embeddable pages). `middleware.js` gates
`/admin/mint/` behind the admin session and sends everyone else to the
sign-in page.

### Served copies of the mint site

The mint site in `../web/` is built and copied into this package by the `web`
build scripts:

- `npm run build:testnet-copy` (in `web/`) → `landing/testnet/`, the public
  copy open to everyone.
- `npm run build:admin-copy` (in `web/`) → `landing/admin/mint/`, the copy
  served only to a signed-in admin.

To close the public testnet again, delete `landing/testnet/`.
