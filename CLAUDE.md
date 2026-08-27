# CLAUDE.md — @meddleware/nft-gate-client

## Invariants

- **No build step.** Ships TypeScript source directly (`"exports": { ".": "./src/index.ts" }`). Consumed by Vite bundlers. Do not add a `build` script or `dist/` output.
- **Client-side only.** This package builds and signs access proofs. It never verifies them — verification is the gateway's responsibility. Do not add signature verification logic here.
- **Wire format is shared.** The `nft-gate:access:<nonce>` personal message prefix and the base64(JSON) proof token encoding are verified by both the Rust gateway and the Cloudflare Workers gateway. Any change to these in `proof.ts` is a breaking change that requires a coordinated update to both gateway implementations in `meddleware-org/nft-gate`.
- **No hardcoded contract addresses.** `packageId`, `gateId`, and `nftType` are always caller-supplied via `AccessGateConfig`. Do not embed testnet or mainnet addresses.
- **No secrets.** Auth tokens, keypairs, and wallet signers are caller-supplied at runtime. Never hardcode credentials.
- **0BSD licence.** Do not change the licence.
- **`@mysten/sui` is the only runtime dependency.** Keep it that way — no additional dependencies without strong justification.
