# Security Policy

## Scope

This policy covers security issues in the `@meddleware/nft-gate-client` package source
(`src/**`) — the access-proof builder/encoder/decoder (`src/proof.ts`), the challenge helper, the
PTB builders (`src/ptb.ts`), and the read-only ownership queries (`src/ownership.ts`).

It does not cover:

- The `nft-gate` gateways that **verify** proofs (see that repo's `SECURITY.md`) — this client
  builds and signs proofs but verifies nothing
- The `access-gate-sui` on-chain package (see that repo's `SECURITY.md`)
- The `@mysten/sui` SDK (report upstream to [Mysten Labs](https://github.com/MystenLabs))
- The caller-supplied wallet/signer, RPC endpoint, and protocol addresses (all injected)

## Security model (invariants)

These invariants are load-bearing. A report demonstrating that any is violated is in scope and
treated as high severity:

1. **The client never verifies and never decides.** `decodeAccessProof` only structurally parses;
   all signature/ownership authorization happens server-side in the gateway.
2. **The client never holds private keys.** Signing is delegated to a caller-supplied signer.
3. **The wire format is frozen and mirrored.** The signed message is exactly
   `nft-gate:access:<nonce>` (UTF-8) and the proof token is
   `base64(JSON{address,nonce,signature,consumeDigest?})` with fixed field order; it is pinned by a
   golden conformance vector shared with both gateway implementations. Any change is a breaking
   change requiring lockstep updates to the gateways and the vector.
4. **No protocol addresses or secrets are hardcoded** in shipped source; `packageId` / `gateId` /
   `nftType` / `platformConfigId` are all caller-supplied.
5. **Parsing is pollution-safe.** `decodeAccessProof` copies only known fields into a fresh object;
   no attacker key reaches a prototype.

> Note on address canonicalization: the proof `address` field is emitted **verbatim** from the
> caller (not normalized). Gateways must normalize both the proof address and the on-chain sender
> before comparison. See the corpus audit's cross-reference (nft-gate F1 / nft-gate-client F1).

## Supported versions

Only the latest published npm version receives security fixes.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Report vulnerabilities by emailing **<security@meddleware.co.uk>**. Include:

- A description of the vulnerability and its impact
- Steps to reproduce or a proof-of-concept (if available)
- The package version or commit SHA you tested against

You will receive an acknowledgement within **3 business days** and a resolution plan within
**14 days** for confirmed issues. Critical issues (CVSS ≥ 9.0) are prioritised for same-day
acknowledgement.

## Disclosure

Once a fix is released, a security advisory will be published on the GitHub repository. Reporters
may be credited by name unless they prefer to remain anonymous.
