# @meddleware/nft-gate-client

[![License: 0BSD](https://img.shields.io/badge/License-0BSD-blue.svg)](LICENSE)

The client side of the [nft-gate](https://github.com/meddleware-org/nft-gate) wire protocol: fetch a
challenge, derive the exact personal message a wallet signs, and encode the access proof a gateway
verifies. Browser-safe, Node-friendly, **no runtime dependencies**.

Building `access_gate` transactions (purchase, consume, gate admin) and reading gates, passes and the
platform configuration: [`@meddleware/access-gate-client`](https://github.com/meddleware-org/access-gate-client).

## Install

```bash
npm install @meddleware/nft-gate-client
```

## Usage

```ts
import { fetchChallenge, buildAccessProof } from '@meddleware/nft-gate-client'

// Single-use gates: first execute an access_gate `consume` (access-gate-client) and keep its digest.
const challenge = await fetchChallenge(gatewayHost)
const token = await buildAccessProof({ address, challenge, sign, consumeDigest })
// send `token` as `Authorization: Bearer <token>` to the gateway / relay
```

## API

| Export | Purpose |
| --- | --- |
| `fetchChallenge(gatewayHost, opts?)` | `GET /v1/challenge` → `{ nonce, expiresAt }` |
| `personalMessageForNonce(nonce)` | the exact bytes the wallet signs: `nft-gate:access:<nonce>` (UTF-8) |
| `buildAccessProof({ address, challenge, sign, consumeDigest? })` | sign the challenge and return the Bearer token; rejects a `consumeDigest` that is not a base58 transaction digest |
| `encodeAccessProof(proof)` / `decodeAccessProof(token)` | base64(JSON) token ↔ `AccessProof` (decode caps size at 4 KiB and enforces ASCII fields) |
| `isTransactionDigest(s)` | base58 Sui transaction-digest shape check |
| types `Challenge`, `AccessProof`, `PersonalMessageSigner` | wire types |

## Wire protocol

- **Challenge**: `{ nonce: string, expiresAt: number }`
- **Signed message**: `nft-gate:access:<nonce>` (UTF-8 bytes)
- **Proof token**: `base64(JSON { address, nonce, signature, consumeDigest? })`, fixed field order

Both gateways in [nft-gate](https://github.com/meddleware-org/nft-gate) verify exactly this format; a
golden vector in `tests/proof.test.ts` pins it.

## Development

```bash
npm run type-check
npm test
npm run build   # emits .d.ts into dist/ (also run by prepublishOnly)
```

## License

[0BSD](LICENSE)
