import type { CoreObject, OwnedAccessNft, OwnedGate, OwnedObjectsClient, SuiObjectClient } from './types.js'

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Unwrap a Move-struct field bag from a core `json` value. The gRPC/core API returns struct
 * fields flat; the old JSON-RPC shape nested them under `.fields`. Tolerate both so parsing is
 * robust to the transport and to the SDK's documented caveat that the `json` shape may vary.
 */
function structFields(v: unknown): Record<string, any> | undefined {
  if (!v || typeof v !== 'object') return undefined
  const o = v as Record<string, any>
  const nested = o.fields
  return nested && typeof nested === 'object' ? (nested as Record<string, any>) : o
}

/**
 * Extract `uses_remaining` from a Move enum `AccessVariant` as rendered by RPC, driven by the
 * enum **variant tag** (typed) rather than guessing from field presence. Sui renders a Move
 * enum as `{ variant: 'SingleUse' | 'UnlimitedPass', fields: {...} }`. Returns `null` for an
 * unlimited pass; the remaining count for a single-use.
 */
function parseUsesRemaining(variant: any): number | null {
  if (variant == null) return null
  const tag: string | undefined = variant.variant ?? variant.type ?? variant.$kind
  if (tag === 'UnlimitedPass') return null
  const fields = variant.fields ?? variant
  const ur = fields?.uses_remaining ?? fields?.SingleUse?.uses_remaining
  if (ur != null) return Number(ur)
  // Either an unknown tag, or a SingleUse whose count is missing from this node's rendering — in
  // both cases the remaining count is unknown, so report null (never a fabricated 0).
  return null
}

/** True if `type` names an `access_gate` NFT struct (transferable or soulbound). */
function isAccessNftType(type: unknown): boolean {
  return typeof type === 'string' && /::access_gate::(Soulbound)?AccessNFT\b/.test(type)
}

/**
 * Parse a single core-API object (a `listOwnedObjects` item or a `getObject`'s `{ object }`) into
 * an {@link OwnedAccessNft}, or `null` if it is not an access NFT. Validates the object **type**
 * when present (typed), and reads the nested `data` fields deterministically.
 */
export function parseOwnedAccessNft(entry: any): OwnedAccessNft | null {
  const obj: CoreObject | undefined = entry?.object ?? entry
  const objectId: string | undefined = obj?.objectId
  const type: unknown = obj?.type
  // When the type is present it MUST be an access NFT; when absent (some node shapes) fall back
  // to structural checks below.
  if (type !== undefined && !isAccessNftType(type)) return null
  const inner = structFields(structFields(obj?.json)?.data)
  const gateId: string | undefined = inner?.gate_id ?? inner?.gateId
  if (!objectId || !gateId) return null
  return {
    objectId,
    gateId,
    usesRemaining: parseUsesRemaining(inner?.variant),
  }
}

/**
 * Typed single-object read of one access NFT by id (`getObject` with `showType`+`showContent`),
 * used when a UI needs the **exact** `usesRemaining` reliably rather than the best-effort parse
 * of an owned-objects page. Returns `null` if the object is missing or not an access NFT.
 *
 * @throws {Error} if the RPC call fails at the network or transport layer.
 */
export async function fetchAccessNftById(
  client: SuiObjectClient,
  objectId: string,
): Promise<OwnedAccessNft | null> {
  const res = await client.core.getObject({ objectId, include: { json: true } })
  return parseOwnedAccessNft(res)
}

/**
 * Fetch all access NFTs of `nftType` owned by `owner`, optionally restricted to a specific
 * `gateId`. Uses `getOwnedObjects` filtered by `StructType` (the standard owned-objects query).
 *
 * @throws {Error} if the RPC call fails at the network or transport layer.
 */
export async function fetchAccessNfts(
  client: OwnedObjectsClient,
  owner: string,
  nftType: string,
  gateId?: string,
): Promise<OwnedAccessNft[]> {
  const { objects } = await client.core.listOwnedObjects({
    owner,
    type: nftType,
    include: { json: true },
  })
  const parsed = (objects ?? [])
    .map(parseOwnedAccessNft)
    .filter((n): n is OwnedAccessNft => n !== null)
  return gateId ? parsed.filter((n) => n.gateId === gateId) : parsed
}

/**
 * True if `owner` holds at least one access NFT of `nftType` (optionally for `gateId`).
 * This is the cheap check a frontend runs to decide whether to show a gated option, and a
 * gateway runs (server-side) as part of access verification.
 *
 * @throws {Error} if the underlying RPC call fails.
 */
export async function ownsAccessNft(
  client: OwnedObjectsClient,
  owner: string,
  nftType: string,
  gateId?: string,
): Promise<boolean> {
  const nfts = await fetchAccessNfts(client, owner, nftType, gateId)
  return nfts.length > 0
}

// ── Gate discovery (operator management) ─────────────────────────────────────────
// An operator holds an `AdminCap` per gate they administer. Discovery: list owned AdminCaps
// (filtered by StructType), read each cap's `gate_id`, then fetch the shared `Gate` object.

/** True if `type` names the `access_gate::AdminCap` struct. */
function isAdminCapType(type: unknown): boolean {
  return typeof type === 'string' && /::access_gate::AdminCap\b/.test(type)
}

/**
 * Parse a single `getOwnedObjects`/`getObject` entry into `{ adminCapId, gateId }`, or `null` if
 * it is not an `AdminCap`. Validates the object **type** when present and reads `fields.gate_id`.
 */
export function parseAdminCap(entry: any): { adminCapId: string; gateId: string } | null {
  const obj: CoreObject | undefined = entry?.object ?? entry
  const adminCapId: string | undefined = obj?.objectId
  const type: unknown = obj?.type
  if (type !== undefined && !isAdminCapType(type)) return null
  const f = structFields(obj?.json)
  const gateId: string | undefined = f?.gate_id ?? f?.gateId
  if (!adminCapId || !gateId) return null
  return { adminCapId, gateId }
}

/**
 * Parse a `getObject` entry for a `Gate` shared object into an {@link OwnedGate} (minus
 * `adminCapId`, which comes from the owning cap). Returns `null` if the object is missing its
 * expected `Gate` fields.
 */
export function parseGate(entry: any): Omit<OwnedGate, 'adminCapId'> | null {
  const obj: CoreObject | undefined = entry?.object ?? entry
  const gateId: string | undefined = obj?.objectId
  const f = structFields(obj?.json)
  if (!gateId || !f) return null
  return {
    gateId,
    priceMist: BigInt(f.price_mist ?? 0),
    paymentRecipient: String(f.payment_recipient ?? ''),
    defaultUses: BigInt(f.default_uses ?? 0),
    soulbound: Boolean(f.soulbound),
    autoBurnAtZero: Boolean(f.auto_burn_at_zero),
    paused: Boolean(f.paused),
    frozen: Boolean(f.frozen),
    nftName: String(f.nft_name ?? ''),
    nftImageUrl: String(f.nft_image_url ?? ''),
    nftDescription: String(f.nft_description ?? ''),
  }
}

/**
 * List the `{ adminCapId, gateId }` pairs for every `access_gate::AdminCap` owned by `owner`
 * under `packageId`. Uses `getOwnedObjects` filtered by `StructType` (the standard query).
 *
 * @throws {Error} if the underlying RPC call fails.
 */
export async function fetchAdminCaps(
  client: OwnedObjectsClient,
  owner: string,
  packageId: string,
): Promise<{ adminCapId: string; gateId: string }[]> {
  const { objects } = await client.core.listOwnedObjects({
    owner,
    type: `${packageId}::access_gate::AdminCap`,
    include: { json: true },
  })
  return (objects ?? [])
    .map(parseAdminCap)
    .filter((c): c is { adminCapId: string; gateId: string } => c !== null)
}

/**
 * Typed single-object read of one `Gate` by id, returning its parsed state (without `adminCapId`).
 * Returns `null` if the object is missing or not a `Gate`.
 *
 * @throws {Error} if the RPC call fails at the network or transport layer.
 */
export async function fetchGate(
  client: SuiObjectClient,
  gateId: string,
): Promise<Omit<OwnedGate, 'adminCapId'> | null> {
  const res = await client.core.getObject({ objectId: gateId, include: { json: true } })
  return parseGate(res)
}

/**
 * Fetch every gate `owner` administers: list their owned `AdminCap`s, then fetch each referenced
 * `Gate` shared object and merge in the owning `adminCapId`. Gates whose object can no longer be
 * read (e.g. deleted) are skipped.
 *
 * @throws {Error} if an underlying RPC call fails at the network or transport layer.
 */
export async function fetchOwnedGates(
  client: OwnedObjectsClient & SuiObjectClient,
  owner: string,
  packageId: string,
): Promise<OwnedGate[]> {
  const caps = await fetchAdminCaps(client, owner, packageId)
  const gates = await Promise.all(
    caps.map(async ({ adminCapId, gateId }) => {
      const gate = await fetchGate(client, gateId)
      return gate ? { ...gate, adminCapId } : null
    }),
  )
  return gates.filter((g): g is OwnedGate => g !== null)
}
