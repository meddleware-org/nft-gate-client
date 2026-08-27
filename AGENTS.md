# AGENTS.md — @meddleware/nft-gate-client

## Package identity

| Field | Value |
|---|---|
| npm name | `@meddleware/nft-gate-client` |
| Version | `0.0.1` |
| Licence | 0BSD |
| Type | TypeScript source package (no build step) |
| Runtime targets | Node.js ≥22, browsers (via Vite) |

## Package layout

```
packages/nft-gate-client/
├── src/
│   ├── index.ts      — public re-exports
│   ├── types.ts      — shared interfaces (AccessGateConfig, Challenge, AccessProof, OwnedAccessNft, …)
│   ├── ownership.ts  — fetchAccessNfts, ownsAccessNft, parseOwnedAccessNft, fetchAccessNftById
│   ├── ptb.ts        — buildPurchaseTx, buildConsumeTx, buildCreateGateTx
│   ├── challenge.ts  — fetchChallenge
│   └── proof.ts      — personalMessageForNonce, buildAccessProof, encodeAccessProof, decodeAccessProof
├── tests/            — vitest unit tests (19 tests)
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── CHANGELOG.md
├── CLAUDE.md
├── AGENTS.md         — this file
├── LICENSE
└── README.md
```

## Key modules

| Module | Responsibility |
|---|---|
| `types.ts` | Shared interfaces. All other modules import from here — do not inline types elsewhere. |
| `ownership.ts` | On-chain NFT ownership queries via `@mysten/sui`. Returns typed `OwnedAccessNft[]`. |
| `ptb.ts` | PTB (Programmable Transaction Block) builders. Returns `Transaction` for caller to sign. |
| `challenge.ts` | `GET /v1/challenge` client. Wire format: `{ nonce, expiresAt }`. |
| `proof.ts` | Personal-message derivation + base64(JSON) proof token construction. Wire format must stay compatible with `meddleware-org/nft-gate` gateways. |

## Commands

```bash
npm run type-check   # tsc --noEmit
npm test             # vitest run
npm run test:watch   # vitest interactive
```

## Publish instructions

No build step — publish TypeScript source directly.

```bash
npm publish --access public
```

Checklist before publishing a new version:
1. Update `version` in `package.json`
2. Add entry to `CHANGELOG.md`
3. Verify `npm run type-check` passes
4. Verify `npm test` passes (all 19 tests green)
5. If wire format changed, coordinate update with `meddleware-org/nft-gate` (gateway + worker must match)

## Relationship to other packages

- **`@meddleware/walrus-client`** (`meddleware-org/walrus-client`): duplicates the challenge/proof helpers in `src/access.ts` for self-containment. Once this package is published, that duplication can be removed — walrus-client will import from here instead.
- **`meddleware-org/nft-gate`**: the gateway and worker that verify the proofs this package produces. Wire protocol changes must be coordinated.
- **`blockchain/sui/contracts/access-gate`** (vault monorepo): the on-chain Move package whose `packageId`/`gateId`/`nftType` values are passed by callers as `AccessGateConfig`. No addresses are hardcoded here.
