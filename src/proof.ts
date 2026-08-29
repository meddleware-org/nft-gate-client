import type { AccessProof, Challenge } from './types.js'

/**
 * The exact bytes a wallet signs (as a personal message) to answer a challenge. Both the
 * client (signing) and the gateway (verifying) MUST derive the message identically.
 */
export function personalMessageForNonce(nonce: string): Uint8Array {
  return new TextEncoder().encode(`nft-gate:access:${nonce}`)
}

function toBase64(s: string): string {
  return btoa(s)
}

function fromBase64(s: string): string {
  return atob(s)
}

/** Encode a proof as the compact Bearer token carried in the relay auth header. */
export function encodeAccessProof(proof: AccessProof): string {
  return toBase64(JSON.stringify(proof))
}

/** Decode a proof token produced by {@link encodeAccessProof}. Throws on malformed input. */
export function decodeAccessProof(token: string): AccessProof {
  const raw = JSON.parse(fromBase64(token)) as Partial<AccessProof>
  if (!raw || typeof raw.address !== 'string' || typeof raw.nonce !== 'string' || typeof raw.signature !== 'string') {
    throw new Error('malformed access proof')
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
