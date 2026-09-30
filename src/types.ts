/**
 * Wire-protocol types shared by clients and the nft-gate gateways. The `access_gate` object model
 * (gates, NFTs, platform config) lives in `@meddleware/access-gate-client`.
 */

/** A server-issued, time-bound challenge the wallet signs to prove control of an address. */
export interface Challenge {
  /** Opaque nonce (as issued by the gateway; treated as a UTF-8 string end-to-end). */
  nonce: string
  /** Unix epoch milliseconds after which the challenge is rejected. */
  expiresAt: number
}

/** The proof a client presents to a gateway to demonstrate gated access. */
export interface AccessProof {
  /** The Sui address claimed by the caller. */
  address: string
  /** The challenge nonce that was signed. */
  nonce: string
  /** Base64 personal-message signature over {@link personalMessageForNonce}. */
  signature: string
  /**
   * For single-use gates: the digest of the on-chain `consume` transaction, so the gateway can
   * confirm the matching `AccessConsumedEvent` before allowing the request.
   */
  consumeDigest?: string
}
