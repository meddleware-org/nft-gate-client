# @meddleware/nft-gate-client

[![License: 0BSD](https://img.shields.io/badge/License-0BSD-blue.svg)](LICENSE)

Client-side TypeScript helpers for the `access_gate` NFT access primitive on Sui. Browser-safe (runs in a wallet app) and Node-friendly. **Client-side only** — server-side verification is provided by the [nft-gate](https://github.com/meddleware-org/nft-gate) service (Rust/Axum gateway or Cloudflare Workers equivalent).

## Install

```bash
npm install @meddleware/nft-gate-client
```

## API

```ts
import {
  ownsAccessNft, fetchAccessNfts,                // ownership queries
  buildPurchaseTx, buildConsumeTx,               // PTB builders (wallet signs + executes)
  fetchChallenge,                                 // GET /v1/challenge
  buildAccessProof, personalMessageForNonce,      // challenge signing + proof token
} from '@meddleware/nft-gate-client'

const cfg = { packageId, gateId, platformConfigId, nftType, soulbound: true }

// 1. Check whether the connected wallet has access:
const hasAccess = await ownsAccessNft(suiClient, address, cfg.nftType, cfg.gateId)

// 2. Purchase access if not:
const tx = buildPurchaseTx(cfg, priceMist)       // wallet signs & executes

// 3. Prove access to a gateway (single-use gateways: consume first, bound to the challenge nonce):
const challenge = await fetchChallenge(gatewayHost)
// const { digest: consumeDigest } = await exec(buildConsumeTx(cfg, nftId, challenge.nonce))
const token = await buildAccessProof({ address, challenge, sign, consumeDigest })
// pass `token` as the relay/gateway Authorization: Bearer header
```

## API Reference

### Ownership

**`ownsAccessNft(client, address, nftType, gateId): Promise<boolean>`**

Returns `true` if the address holds at least one unexpired access NFT matching the gate.

**`fetchAccessNfts(client, address, nftType): Promise<OwnedAccessNft[]>`**

Returns all access NFTs owned by an address for a given struct type.

**`fetchAccessNftById(client, objectId): Promise<OwnedAccessNft | null>`**

Fetch a single access NFT by object ID.

**`parseOwnedAccessNft(object): OwnedAccessNft | null`**

Parse a raw `SuiObjectResponse` into an `OwnedAccessNft`. Returns `null` if the object is not a valid access NFT.

### PTB Builders

**`buildPurchaseTx(config, priceMist): Transaction`**

Build a transaction to purchase an access NFT. Caller signs and executes with their wallet.

**`buildConsumeTx(config, nftObjectId, nonce): Transaction`**

Build a transaction that spends one use of a single-use pass, bound to `nonce` (the gateway's
challenge nonce; ≥ 8 bytes). Calls `consume` or `consume_soulbound` from `config.soulbound`. An
exhausted pass is deleted if the gate auto-burns, otherwise kept. Execute it before calling
`buildAccessProof` with the resulting `consumeDigest`.

**`buildCreateGateTx(packageId, opts): Transaction`**

Build a transaction to create a new access gate on-chain (admin operation). `opts.policy` is an
optional `GatePolicy` — immutable restrictions a tool's operator applies to the gates it creates:

| Flag | Effect |
| --- | --- |
| `freezeRequiresUnpaused` | `make_gate_immutable` aborts (code 10) while the gate is paused. |
| `lockCommissionOnFreeze` | Freezing snapshots the platform commission; frozen purchases use it. |
| `pauseBlocksDecryption` | Seal `nft_gate` (and other honouring policies) deny access while paused. |

With no policy (or `DEFAULT_GATE_POLICY`, all `false`) the builder calls `create_gate`, which every
package version supports; a restrictive policy calls `new_gate_policy` + `create_gate_with_policy`,
which need a policy-aware package.

**`buildMakeGateImmutableTx(ctx, platformConfigId): Transaction`**

Irreversibly freeze a gate (consumes its `AdminCap`). Passes the shared `PlatformConfig` for the
commission snapshot. The other admin setters (`buildSetPriceTx`, `buildSetPausedTx`, …,
`buildAirdropTx`) take a `GateAdminContext`.

**`minimumProfitablePriceMist(commissionBps): bigint`** / **`commissionForPrice(price, bps): bigint`**

Commission arithmetic mirroring the contract (rounds down). `minimumProfitablePriceMist` is
`⌈10000 / commissionBps⌉` — the smallest non-zero price that yields at least 1 MIST of commission
(500 MIST at 20 bps); tools can use it as their minimum gate price.

**`fetchPlatformCommission(client, platformConfigId): Promise<PlatformCommission | null>`**

Read `{ treasury, commissionBps }` from a package's shared `PlatformConfig`.

### Challenge & Proof

**`fetchChallenge(gatewayHost, opts?): Promise<Challenge>`**

Fetch a time-bound nonce from the gateway's `GET /v1/challenge` endpoint.

**`personalMessageForNonce(nonce): Uint8Array`**

Returns the exact bytes the wallet must sign for a nonce. Matches the gateway's derivation: `nft-gate:access:<nonce>`.

**`buildAccessProof(opts): Promise<string>`**

One-shot helper: sign the challenge with the wallet and return the base64(JSON) Bearer token to pass to the gateway or relay.

**`encodeAccessProof(proof: AccessProof): string`**

Encode a proof struct directly to a base64(JSON) token (lower-level, sync).

**`decodeAccessProof(token: string): AccessProof`**

Decode a base64(JSON) token back to a proof struct.

## Wire protocol

- **Challenge**: `{ nonce: string, expiresAt: number }`
- **Signed message**: `nft-gate:access:<nonce>` (UTF-8 bytes)
- **Proof token**: `base64(JSON { address, nonce, signature, consumeDigest? })`

This format is verified by both the Rust gateway and the Cloudflare Workers gateway in the [nft-gate](https://github.com/meddleware-org/nft-gate) repo.

## Types

```ts
interface AccessGateConfig {
  packageId: string
  gateId: string
  platformConfigId: string // the package's shared PlatformConfig (commission)
  nftType: string
  soulbound: boolean
}

interface Challenge {
  nonce: string
  expiresAt: number
}

interface AccessProof {
  address: string
  nonce: string
  signature: string
  consumeDigest?: string
}

interface OwnedAccessNft {
  objectId: string
  gateId: string
  expiresAt?: number
}
```

## Development

```bash
npm run type-check   # tsc --noEmit
npm test             # vitest run (19 unit tests)
npm run test:watch   # vitest interactive
```

## License

[0BSD](LICENSE)
