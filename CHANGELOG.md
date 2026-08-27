# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.1] - 2026-08-27

### Added

- Initial release as `@meddleware/nft-gate-client`
- `ownsAccessNft`, `fetchAccessNfts`, `fetchAccessNftById`, `parseOwnedAccessNft` — on-chain ownership queries via `@mysten/sui`
- `buildPurchaseTx`, `buildConsumeTx`, `buildCreateGateTx` — PTB builders for purchase, single-use consume, and gate creation
- `fetchChallenge` — `GET /v1/challenge` client for the nft-gate gateway wire protocol
- `personalMessageForNonce`, `buildAccessProof`, `encodeAccessProof`, `decodeAccessProof` — challenge signing and proof token construction
- Wire protocol compatible with both the Rust/Axum gateway and the Cloudflare Workers gateway in `meddleware-org/nft-gate`
