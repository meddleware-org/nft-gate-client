# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Targets the policy-aware `access_gate` (testnet `0x1a81ca17…eea4`); packages that predate it are not
supported by the admin builders.

### Added

- `GatePolicy` (`freezeRequiresUnpaused`, `lockCommissionOnFreeze`, `pauseBlocksDecryption`, `pauseBlocksAccess`), `DEFAULT_GATE_POLICY`, `isRestrictivePolicy`.
- `buildMakeGateFreeTx(ctx, feeMist)`.
- `fetchPlatformConfig` / `parsePlatformConfig` (`PlatformConfigInfo`), `CommissionTerms`, `commissionForPrice`, `minimumPaidPriceMist`, `gateCommissionMist`, `platformCommissionTerms`, `BPS_DENOMINATOR`, `MAX_COMMISSION_BPS`.
- `OwnedGate.policy`, `.lockedCommission` and `.freeFeePaid`, parsed by `parseGate`.
- `isTransactionDigest(s)`; `buildAccessProof` rejects a `consumeDigest` that is not a base58 Sui
  transaction digest (before asking the wallet to sign).

### Changed

- **Breaking:** `GateAdminContext` gains `platformConfigId`; `buildSetPriceTx`, `buildMakeGateImmutableTx` pass it.
- **Breaking:** `buildCreateGateTx(packageId, platformConfigId, opts)` always sends a `GatePolicy`; price 0 calls `create_free_gate` with `opts.freeGateFeeMist`.
- **Breaking:** `buildAirdropTx(ctx, recipient, commissionMist)` pays the airdrop commission.
- `usesRemaining` is parsed exactly from the u64 (via `BigInt`), saturating at
  `Number.MAX_SAFE_INTEGER`; a malformed count is `null` (unknown), never a fabricated number.

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
