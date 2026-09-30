/**
 * `@meddleware/nft-gate-client` — the nft-gate wire protocol, client side.
 *
 * Challenge fetching, the personal message a wallet signs, and access-proof encoding/decoding —
 * the one contract shared with both nft-gate gateways (golden vector in the tests). No runtime
 * dependencies. Building `access_gate` transactions and reading gates/NFTs:
 * `@meddleware/access-gate-client`.
 */

export type { Challenge, AccessProof } from './types.js'
export { fetchChallenge } from './challenge.js'
export {
  personalMessageForNonce,
  encodeAccessProof,
  decodeAccessProof,
  buildAccessProof,
  isTransactionDigest,
} from './proof.js'
export type { PersonalMessageSigner } from './proof.js'
