import type { OwnedAccessNft, OwnedGate, OwnedObjectsClient, SuiObjectClient } from './types.js'

/* eslint-disable @typescript-eslint/no-explicit-any */

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
  // Tagged SingleUse but the count is missing from this node's rendering — unknown, not a pass.
  return tag === 'SingleUse' ? null : null
}

/** True if `type` names an `access_gate` NFT struct (transferable or soulbound). */
function isAccessNftType(type: unknown): boolean {
  return typeof type === 'string' && /::access_gate::(Soulbound)?AccessNFT\b/.test(type)
}

/**
 * Parse a single `getOwnedObjects`/`getObject` entry into an {@link OwnedAccessNft}, or `null`
 * if it is not an access NFT. Validates the object **type** when present (typed), and reads the
 * nested `data.fields` deterministically.
 */
export function parseOwnedAccessNft(entry: any): OwnedAccessNft | null {
  const obj = entry?.data ?? entry
  const objectId: string | undefined = obj?.objectId ?? obj?.content?.fields?.id?.id
  const type: unknown = obj?.type ?? obj?.content?.type
  // When the type is present it MUST be an access NFT; when absent (some node shapes) fall back
  // to structural checks below.
  if (type !== undefined && !isAccessNftType(type)) return null
  const inner = obj?.content?.fields?.data?.fields
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
  const res = await client.getObject({
    id: objectId,
    options: { showType: true, showContent: true },
  })
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
  const { data } = await client.getOwnedObjects({
    owner,
    filter: { StructType: nftType },
    options: { showContent: true, showType: true },
  })
  const parsed = (data ?? [])
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
  const obj = entry?.data ?? entry
  const adminCapId: string | undefined = obj?.objectId ?? obj?.content?.fields?.id?.id
  const type: unknown = obj?.type ?? obj?.content?.type
  if (type !== undefined && !isAdminCapType(type)) return null
  const gateId: string | undefined = obj?.content?.fields?.gate_id ?? obj?.content?.fields?.gateId
  if (!adminCapId || !gateId) return null
  return { adminCapId, gateId }
}

/**
 * Parse a `getObject` entry for a `Gate` shared object into an {@link OwnedGate} (minus
 * `adminCapId`, which comes from the owning cap). Returns `null` if the object is missing its
 * expected `Gate` fields.
 */
export function parseGate(entry: any): Omit<OwnedGate, 'adminCapId'> | null {
  const obj = entry?.data ?? entry
  const gateId: string | undefined = obj?.objectId ?? obj?.content?.fields?.id?.id
  const f = obj?.content?.fields
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
  const { data } = await client.getOwnedObjects({
    owner,
    filter: { StructType: `${packageId}::access_gate::AdminCap` },
    options: { showContent: true, showType: true },
  })
  return (data ?? [])
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
  const res = await client.getObject({ id: gateId, options: { showType: true, showContent: true } })
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
