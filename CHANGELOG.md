# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- `"sideEffects": false` in `package.json`: the package has no import-time side effects.

## [0.0.14] - 2026-10-02

### Changed

- `fetchChallenge` aborts after `timeoutMs` (default 10 s) as well as on the caller's `signal`, so a
  hung gateway no longer stalls an upload. The host must be `https:` (`http:` only for a loopback
  host) and the URL is built with `new URL` (a path prefix is kept; query and fragment are dropped).
  The response is size-capped (4 KiB) before parsing; `nonce` must be a non-empty ASCII string and
  the expiry a finite number.

## [0.0.13] - 2026-09-30

### Changed

- **Breaking:** the package is now the nft-gate **wire protocol only** — `fetchChallenge`,
  `personalMessageForNonce`, `buildAccessProof`, `encodeAccessProof`, `decodeAccessProof`,
  `isTransactionDigest` and the `Challenge` / `AccessProof` / `PersonalMessageSigner` types. Every
  `access_gate` PTB builder, read and object type moved to `@meddleware/access-gate-client`
  (no re-exports).
- No runtime dependencies (`@mysten/sui` removed).

### Added

- `isTransactionDigest(s)`; `buildAccessProof` rejects a `consumeDigest` that is not a base58 Sui
  transaction digest (before asking the wallet to sign).

## [0.0.8] - 2026-09-17

### Added

- `homepage` in `package.json` — links to the Access Gate section of the documentation site.

## [0.0.3] - 2026-08-29

### Added

- Gate administration PTB builders (AdminCap-gated): `buildSetPriceTx`, `buildSetPaymentRecipientTx`, `buildSetPausedTx`, `buildSetDefaultUsesTx`, `buildSetSoulboundTx`, `buildSetAutoBurnAtZeroTx`, `buildSetNftNameTx`, `buildSetNftImageUrlTx`, `buildSetNftDescriptionTx`, `buildAirdropTx`, `buildMakeGateImmutableTx`
- `GateAdminContext` type (`{ packageId, gateId, adminCapId }`) for the management builders
- Gate discovery helpers: `fetchOwnedGates`, `fetchAdminCaps`, `fetchGate`, `parseAdminCap`, `parseGate`, and the `OwnedGate` type — list and read the gates an operator administers
- `@throws` annotations on the async ownership / challenge / proof functions

## [0.0.1] - 2026-08-27

### Added

- Initial release as `@meddleware/nft-gate-client`
- `ownsAccessNft`, `fetchAccessNfts`, `fetchAccessNftById`, `parseOwnedAccessNft` — on-chain ownership queries via `@mysten/sui`
- `buildPurchaseTx`, `buildConsumeTx`, `buildCreateGateTx` — PTB builders for purchase, single-use consume, and gate creation
- `fetchChallenge` — `GET /v1/challenge` client for the nft-gate gateway wire protocol
- `personalMessageForNonce`, `buildAccessProof`, `encodeAccessProof`, `decodeAccessProof` — challenge signing and proof token construction
- Wire protocol compatible with both the Rust/Axum gateway and the Cloudflare Workers gateway in `meddleware-org/nft-gate`
