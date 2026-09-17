# CLAUDE.md — @meddleware/nft-gate-client

## Invariants

- **Declaration-only build step.** Ships TypeScript source as the runtime (`default` export condition) and emits `.d.ts` declarations into `dist/` via `tsconfig.build.json` (`emitDeclarationOnly: true`). `prepublishOnly` runs the build automatically before every `npm publish`. The `types` export condition points at `dist/index.d.ts` so consumers don't require TypeScript to process raw `.ts` source from node_modules. Do not add a full transpile step or change the `default` export to point at `dist/`.
- **Client-side only.** This package builds and signs access proofs. It never verifies them — verification is the gateway's responsibility. Do not add signature verification logic here.
- **Wire format is shared.** The `nft-gate:access:<nonce>` personal message prefix and the base64(JSON) proof token encoding are verified by both the Rust gateway and the Cloudflare Workers gateway. Any change to these in `proof.ts` is a breaking change that requires a coordinated update to both gateway implementations in `meddleware-org/nft-gate`.
- **No hardcoded contract addresses.** `packageId`, `gateId`, and `nftType` are always caller-supplied via `AccessGateConfig`. Do not embed testnet or mainnet addresses.
- **No secrets.** Auth tokens, keypairs, and wallet signers are caller-supplied at runtime. Never hardcode credentials.
- **0BSD licence.** Do not change the licence.
- **`@mysten/sui` is the only runtime dependency.** Keep it that way — no additional dependencies without strong justification.

---

## Deferred documentation — NOT for the `docs.` website (planned here per Part 0.4)

> Captured for the future **`dev.meddleware.co.uk`** subdomain; excluded from the user-facing
> `docs.` site. The Access Gate user docs cover buying/using passes, not building against the SDK.

### `dev.` — developer integration (to write later)

- **Full SDK reference** (TypeDoc target — ships `.d.ts`): the PTB builders (`create_gate`, `purchase`,
  `consume`, airdrop/admin setters), ownership reads (`fetchOwnedGates`/`fetchGate`), and the
  challenge/proof helpers.
- **Wire-protocol spec:** the `nft-gate:access:<nonce>` personal-message prefix and base64(JSON) proof
  token encoding — the canonical contract shared with **both** gateway implementations
  (`meddleware-org/nft-gate`). This is the authoritative schema for the docs-site Access Gate
  reference and for anyone verifying proofs.
- **Config:** `AccessGateConfig` (`packageId`/`gateId`/`nftType`) — always caller-supplied; document
  how to source each after deploying `access_gate`.
