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

const cfg = { packageId, gateId, nftType, soulbound: true }

// 1. Check whether the connected wallet has access:
const hasAccess = await ownsAccessNft(suiClient, address, cfg.nftType, cfg.gateId)

// 2. Purchase access if not:
const tx = buildPurchaseTx(cfg, priceMist)       // wallet signs & executes

// 3. Prove access to a gateway (single-use: submit buildConsumeTx first):
const challenge = await fetchChallenge(gatewayHost)
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

**`buildConsumeTx(config, nftObjectId): Transaction`**

Build a transaction to consume (burn) a single-use access NFT, proving use. Submit before calling `buildAccessProof` with the resulting `consumeDigest`.

**`buildCreateGateTx(config): Transaction`**

Build a transaction to create a new access gate on-chain (admin operation).

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
