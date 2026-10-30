# Security Policy

## Status

**The contracts are not audited.** They are tested end to end but have not
been independently audited. Use at your own risk. Testnet tokens have no
monetary value.

A few properties worth knowing when reviewing or reporting:

- **Not upgradeable.** The owner can change prices, limits, phase, allowlist
  root, royalty, renderer and arena address, and withdraw proceeds. The owner
  **cannot** read or change any cat's DNA.
- **Fhenix dependency.** Minting, peeking, opening and the arena rely on
  Fhenix CoFHE. Transfers and the on-chain images do not.
- **Royalties** (ERC-2981) are informational; marketplaces may not enforce
  them.

## Reporting a vulnerability

Please report security issues privately, not in a public issue or pull
request.

- Preferred: open a private advisory through GitHub's
  [private vulnerability reporting](https://github.com/FheCat/FheCat/security/advisories/new).
- Alternatively, contact the maintainer, [@furkan3152](https://github.com/furkan3152),
  or [@FheCat on X](https://x.com/FheCat).

Please include steps to reproduce, the affected contract or component, and the
network and addresses involved. We will acknowledge your report and keep you
updated on the fix. Please give us a reasonable chance to address the issue
before any public disclosure.
