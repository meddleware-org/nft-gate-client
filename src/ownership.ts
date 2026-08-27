import type { OwnedAccessNft, OwnedObjectsClient, SuiObjectClient } from './types.js'

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
