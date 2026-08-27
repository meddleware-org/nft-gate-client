/**
 * Shared wire + config types for the access-gate client.
 *
 * These mirror the on-chain `access_gate` Move package and the challenge/proof wire
 * protocol implemented by the generic Rust gateway. Keep the three in sync.
 */

/** Identifies a deployed gate and the NFT type that satisfies it. */
export interface AccessGateConfig {
  /** Published `access_gate` package ID. */
  packageId: string
  /** The shared `Gate` object ID. */
  gateId: string
  /**
   * Fully-qualified NFT type string to filter ownership by, e.g.
   * `<pkg>::access_gate::AccessNFT` or `<pkg>::access_gate::SoulboundAccessNFT`.
   * Choose the variant matching the gate's `soulbound` flag.
   */
  nftType: string
  /** Whether this gate mints soulbound NFTs (selects `consume` vs `consume_soulbound`). */
  soulbound?: boolean
}

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
   * For single-use gates: the digest of the on-chain `consume(nft, nonce)` transaction, so
   * the gateway can confirm the matching `AccessConsumedEvent` before allowing the request.
   */
  consumeDigest?: string
}

/** A parsed owned access NFT. */
export interface OwnedAccessNft {
  objectId: string
  gateId: string
  /** `null` for an unlimited pass; otherwise remaining single-use count. */
  usesRemaining: number | null
}

/** Minimal structural subset of a Sui client used for ownership queries (grpc or json-rpc). */
export interface OwnedObjectsClient {
  getOwnedObjects(params: {
    owner: string
    filter?: { StructType: string }
    options?: { showContent?: boolean; showType?: boolean }
    cursor?: string | null
    limit?: number | null
  }): Promise<{ data: unknown[]; hasNextPage?: boolean; nextCursor?: string | null }>
}

/** Minimal structural subset of a Sui client used for a typed single-object read. */
export interface SuiObjectClient {
  getObject(params: {
    id: string
    options?: { showContent?: boolean; showType?: boolean }
  }): Promise<unknown>
}
