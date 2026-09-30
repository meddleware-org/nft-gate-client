# AGENTS.md — @meddleware/nft-gate-client

## Package identity

| Field | Value |
| --- | --- |
| npm name | `@meddleware/nft-gate-client` |
| Licence | 0BSD |
| Build | declaration-only (`tsc -p tsconfig.build.json` → `dist/*.d.ts`); ships TS source |
| Runtime dependencies | none |
| Runtime targets | Node.js ≥ 22, browsers, workerd |

## Layout

```text
src/
  index.ts      public re-exports
  types.ts      Challenge, AccessProof
  challenge.ts  fetchChallenge
  proof.ts      personalMessageForNonce, buildAccessProof, encode/decodeAccessProof, isTransactionDigest
tests/          vitest unit tests, incl. the golden wire-format vector
```

## Rules

- The wire format (`nft-gate:access:<nonce>`, base64(JSON) proof, field order) is shared with both
  gateways in `meddleware-org/nft-gate` and pinned by the golden vector — change them together.
- `access_gate` builders/reads belong in `@meddleware/access-gate-client`, not here.
- No runtime dependencies; no hardcoded addresses; no secrets.

## Commands

```bash
npm run type-check && npm run lint && npm test && npm run build
```
