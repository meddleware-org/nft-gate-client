import type { AccessProof, Challenge } from './types.js'

/**
 * The exact bytes a wallet signs (as a personal message) to answer a challenge. Both the
 * client (signing) and the gateway (verifying) MUST derive the message identically.
 */
export function personalMessageForNonce(nonce: string): Uint8Array {
  return new TextEncoder().encode(`nft-gate:access:${nonce}`)
}

// UTF-8-safe base64. The naive `btoa(str)` operates on Latin-1 and throws/corrupts on any code
// point > 0xFF, so we round-trip through UTF-8 bytes first. For pure-ASCII payloads (the only kind
// this wire format carries — see the ASCII contract below) the output is byte-identical to `btoa`,
// so the gateways' decoders are unaffected.
function toBase64(s: string): string {
  const bytes = new TextEncoder().encode(s)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

function fromBase64(s: string): string {
  const bin = atob(s)
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

/** True iff every character is ASCII (code point ≤ 0x7F). */
function isAscii(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) > 0x7f) return false
  }
  return true
}

/** Encode a proof as the compact Bearer token carried in the relay auth header. */
export function encodeAccessProof(proof: AccessProof): string {
  return toBase64(JSON.stringify(proof))
}

/**
 * Decode a proof token produced by {@link encodeAccessProof}. Throws on malformed input.
 *
 * ASCII contract: both gateways issue ASCII-only nonces (`<region>.<hex>` or hex) and treat
 * `address`/`nonce` as ASCII end-to-end. We enforce that here so a non-ASCII field is rejected
 * rather than silently diverging between the client and a gateway verifier. `address` is emitted
 * verbatim (raw); canonicalisation is owned gateway-side (see nft-gate `verify.rs`/`verify.ts`), so
 * the wire format is unchanged and the golden vector stays stable.
 */
/** Maximum encoded token length (bytes). Prevents a multi-MB blob from saturating `atob`/`JSON.parse`. */
const MAX_TOKEN_BYTES = 4096

export function decodeAccessProof(token: string): AccessProof {
  if (token.length > MAX_TOKEN_BYTES) {
    throw new Error(`access proof token too large (${token.length} > ${MAX_TOKEN_BYTES})`)
  }
  const raw = JSON.parse(fromBase64(token)) as Partial<AccessProof>
  if (!raw || typeof raw.address !== 'string' || typeof raw.nonce !== 'string' || typeof raw.signature !== 'string') {
    throw new Error('malformed access proof')
  }
  if (!isAscii(raw.address) || !isAscii(raw.nonce) || !isAscii(raw.signature)) {
    throw new Error('non-ASCII field in access proof')
  }
  const proof: AccessProof = { address: raw.address, nonce: raw.nonce, signature: raw.signature }
  if (typeof raw.consumeDigest === 'string') proof.consumeDigest = raw.consumeDigest
  return proof
}

/** A wallet-provided personal-message signer (e.g. wallet-standard `sui:signPersonalMessage`). */
export type PersonalMessageSigner = (message: Uint8Array) => Promise<{ signature: string }>

/**
 * Sign a challenge and assemble the encoded access-proof token to hand to any gateway as its
 * auth bearer (e.g. an upload-relay client's auth-token option, an `Authorization` header).
 *
 * @throws {Error} if the wallet signer rejects or fails to sign the message.
 */
export async function buildAccessProof(opts: {
  address: string
  challenge: Challenge
  sign: PersonalMessageSigner
  /** Present for single-use gates: the `consume` tx digest. */
  consumeDigest?: string
}): Promise<string> {
  const message = personalMessageForNonce(opts.challenge.nonce)
  const { signature } = await opts.sign(message)
  const proof: AccessProof = { address: opts.address, nonce: opts.challenge.nonce, signature }
  if (opts.consumeDigest) proof.consumeDigest = opts.consumeDigest
  return encodeAccessProof(proof)
}
