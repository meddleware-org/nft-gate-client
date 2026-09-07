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
  /** The shared `PlatformConfig` object ID. Required for `buildPurchaseTx`. */
  platformConfigId: string
  /**
   * Fully-qualified NFT type string to filter ownership by, e.g.
   * `<pkg>::access_gate::AccessNFT` or `<pkg>::access_gate::SoulboundAccessNFT`.
   * Choose the variant matching the gate's `soulbound` flag.
   */
  nftType: string
  /** Whether this gate mints soulbound NFTs (selects `consume` vs `consume_soulbound`). */
  soulbound?: boolean
}

/**
 * Identifies a gate an operator administers, for the AdminCap-gated management PTB builders
 * (setters, airdrop, freeze). The three ids together authorise a call: `adminCapId` must be the
 * `AdminCap` whose `gate_id` matches `gateId`, under the published `packageId`.
 */
export interface GateAdminContext {
  /** Published `access_gate` package ID. */
  packageId: string
  /** The shared `Gate` object ID being administered. */
  gateId: string
  /** The `AdminCap` object ID authorised over `gateId` (held by the operator). */
  adminCapId: string
}

/** A gate an operator administers, parsed from its on-chain `Gate` object + owning `AdminCap`. */
export interface OwnedGate {
  /** The shared `Gate` object ID. */
  gateId: string
  /** The `AdminCap` object ID that authorises administering this gate. */
  adminCapId: string
  /** Price in MIST charged by `purchase` (0 = free). */
  priceMist: bigint
  /** Address that receives the operator share of each paid `purchase`. */
  paymentRecipient: string
  /** 0 ⇒ unlimited passes; N ⇒ single-use NFTs with N uses. */
  defaultUses: bigint
  /** Whether newly-minted NFTs are soulbound. */
  soulbound: boolean
  /** Whether a single-use NFT is deleted (vs. kept as a receipt) at zero uses. */
  autoBurnAtZero: boolean
  /** Whether `purchase` is currently disabled. */
  paused: boolean
  /** Whether the gate has been made immutable (all admin/airdrop permanently disabled). */
  frozen: boolean
  /** Default NFT display name minted into future NFTs. */
  nftName: string
  /** Default NFT image URL minted into future NFTs. */
  nftImageUrl: string
  /** Default NFT description minted into future NFTs. */
  nftDescription: string
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

/**
 * A single owned/read object as returned by the unified core API (`SuiGrpcClient`): the id and
 * Move struct type are top-level; the struct fields come back under `json` (opt-in). Kept as a
 * structural subset so any client exposing the core API satisfies it without importing the SDK.
 */
export interface CoreObject {
  objectId: string
  type?: string
  json?: Record<string, unknown> | null
}

/** Minimal structural subset of a core Sui client used for owned-object listing (`SuiGrpcClient`). */
export interface OwnedObjectsClient {
  core: {
    listOwnedObjects(options: {
      owner: string
      type?: string
      cursor?: string | null
      limit?: number
      include?: { json?: boolean }
    }): Promise<{ objects: CoreObject[]; hasNextPage: boolean; cursor: string | null }>
  }
}

/** Minimal structural subset of a core Sui client used for a typed single-object read. */
export interface SuiObjectClient {
  core: {
    getObject(options: { objectId: string; include?: { json?: boolean } }): Promise<{ object: CoreObject }>
  }
}
