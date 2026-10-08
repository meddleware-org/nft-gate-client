import type { AccessMessageContext, AccessProof, Challenge, SuiNetwork } from './types.js'

/** First line of every signed access message; a signature made for another purpose or version never matches. */
export const ACCESS_MESSAGE_VERSION = 'nft-gate:access:v2'

const NETWORKS: readonly SuiNetwork[] = ['localnet', 'devnet', 'testnet', 'mainnet']
/** Characters a gateway may put in a nonce; no whitespace, so a nonce cannot add a line to the message. */
const NONCE = /^[A-Za-z0-9._~-]{1,128}$/
const GATE_ID = /^0x[0-9a-f]{64}$/
const ADDRESS = /^0x[0-9a-fA-F]{1,64}$/
/** Standard base64 with optional padding; a Sui signature is well under 1 KiB. */
const SIGNATURE = /^[A-Za-z0-9+/]{1,1024}={0,2}$/
/** Base58 alphabet (no 0, O, I, l); a Sui transaction digest is 32 bytes → at most 44 characters. */
const TX_DIGEST = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
const LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '[::1]']

/** True if `s` has the shape of a base58 Sui transaction digest. */
export function isTransactionDigest(s: string): boolean {
  return TX_DIGEST.test(s)
}

/** True iff every character is ASCII (code point ≤ 0x7F). Internal: not re-exported from the index. */
export function isAscii(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) > 0x7f) return false
  }
  return true
}

/** True if `s` is a nonce a gateway may issue (see {@link Challenge.nonce}). */
export function isNonce(s: string): boolean {
  return NONCE.test(s)
}

/**
 * The canonical origin of a gateway URL: what is signed and what a gateway configures. `https` only
 * (`http` for a loopback host), no credentials, no path, query or fragment beyond what `URL` drops,
 * default port omitted, host lower-cased.
 *
 * @throws {Error} if `gateway` is not such a URL.
 */
export function gatewayOrigin(gateway: string): string {
  let url: URL
  try {
    url = new URL(gateway)
  } catch {
    throw new Error(`invalid gateway URL: ${gateway}`)
  }
  const loopback = LOOPBACK_HOSTS.includes(url.hostname)
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) {
    throw new Error(`gateway URL must use https: ${gateway}`)
  }
  if (url.username || url.password) throw new Error('gateway URL must not carry credentials')
  return url.origin
}

function requireContext(ctx: AccessMessageContext): void {
  if (gatewayOriginOrNull(ctx.origin) !== ctx.origin) throw new Error('origin is not a canonical gateway origin')
  if (!GATE_ID.test(ctx.gateId)) throw new Error('gateId must be 0x followed by 64 lower-case hex digits')
  if (!NETWORKS.includes(ctx.network)) throw new Error(`network must be one of ${NETWORKS.join(', ')}`)
  if (!NONCE.test(ctx.nonce)) throw new Error('nonce is not a valid challenge nonce')
  if (ctx.consumeDigest !== undefined && !TX_DIGEST.test(ctx.consumeDigest)) {
    throw new Error('consumeDigest is not a base58 Sui transaction digest')
  }
}

function gatewayOriginOrNull(s: string): string | null {
  try {
    return gatewayOrigin(s)
  } catch {
    return null
  }
}

/**
 * The exact bytes a wallet signs (as a personal message) to answer a challenge. Both the client
 * (signing) and the gateway (verifying) MUST derive the message identically; the gateway builds it
 * from its own origin, gate and network. ASCII, one `key:value` line each, so a wallet can show it:
 *
 * ```text
 * nft-gate:access:v2
 * origin:<origin>
 * gate:<gate id>
 * network:<network>
 * nonce:<nonce>
 * consume:<digest>        (single-use gateways only)
 * ```
 *
 * @throws {Error} if a field is not in its canonical form (which also prevents line injection).
 */
export function personalMessage(ctx: AccessMessageContext): Uint8Array {
  requireContext(ctx)
  const lines = [ACCESS_MESSAGE_VERSION, `origin:${ctx.origin}`, `gate:${ctx.gateId}`, `network:${ctx.network}`, `nonce:${ctx.nonce}`]
  if (ctx.consumeDigest !== undefined) lines.push(`consume:${ctx.consumeDigest}`)
  return new TextEncoder().encode(lines.join('\n'))
}

// UTF-8-safe base64. The naive `btoa(str)` operates on Latin-1 and throws/corrupts on any code
// point > 0xFF, so we round-trip through UTF-8 bytes first. For pure-ASCII payloads (the only kind
// this wire format carries — see the ASCII contract below) the output is byte-identical to `btoa`.
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

/** Every rule a proof must satisfy, applied identically when encoding and decoding. */
function requireProofShape(p: Record<string, unknown>): AccessProof {
  if (typeof p.address !== 'string' || typeof p.nonce !== 'string' || typeof p.signature !== 'string') {
    throw new Error('malformed access proof')
  }
  if (!isAscii(p.address) || !isAscii(p.nonce) || !isAscii(p.signature)) throw new Error('non-ASCII field in access proof')
  if (!ADDRESS.test(p.address)) throw new Error('address must be 0x followed by 1-64 hex digits')
  if (!NONCE.test(p.nonce)) throw new Error('nonce is not a valid challenge nonce')
  if (!SIGNATURE.test(p.signature)) throw new Error('signature is not base64')
  const proof: AccessProof = { address: p.address, nonce: p.nonce, signature: p.signature }
  if (p.consumeDigest !== undefined) {
    if (typeof p.consumeDigest !== 'string' || !TX_DIGEST.test(p.consumeDigest)) {
      throw new Error('consumeDigest is not a base58 Sui transaction digest')
    }
    proof.consumeDigest = p.consumeDigest
  }
  return proof
}

/**
 * Encode a proof as the compact Bearer token carried in the relay auth header.
 *
 * @throws {Error} if a field breaks the same rules {@link decodeAccessProof} enforces, so a token this
 *   emits is one every gateway accepts.
 */
export function encodeAccessProof(proof: AccessProof): string {
  return toBase64(JSON.stringify(requireProofShape({ ...proof })))
}

/** Maximum encoded token length (bytes). Prevents a multi-MB blob from saturating `atob`/`JSON.parse`. */
const MAX_TOKEN_BYTES = 4096

/**
 * Decode a proof token produced by {@link encodeAccessProof}. Throws on malformed input.
 *
 * Both gateways apply the same rules (the shared vectors pin them): at most 4096 characters, a
 * `0x` + 1–64 hex address, a challenge-shaped nonce, a base64 signature, and — when present — a
 * base58 transaction digest. `address` is emitted verbatim; canonicalisation is owned gateway-side.
 *
 * @throws {Error} if the token is oversized, not base64/JSON, or any field breaks those rules.
 */
export function decodeAccessProof(token: string): AccessProof {
  if (token.length > MAX_TOKEN_BYTES) {
    throw new Error(`access proof token too large (${token.length} > ${MAX_TOKEN_BYTES})`)
  }
  const raw: unknown = JSON.parse(fromBase64(token))
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new Error('malformed access proof')
  return requireProofShape(raw as Record<string, unknown>)
}

/** A wallet-provided personal-message signer (e.g. wallet-standard `sui:signPersonalMessage`). */
export type PersonalMessageSigner = (message: Uint8Array) => Promise<{ signature: string }>

/**
 * Sign a challenge and assemble the encoded access-proof token to hand to the gateway as its auth
 * bearer (e.g. an upload-relay client's auth-token option, an `Authorization` header).
 *
 * The signed message binds the gateway's origin, the gate, the network and — for a single-use
 * gateway — the consume digest, so the token is useless anywhere else. Pass `consumeDigest` exactly
 * when the gateway runs single-use (it rebuilds the message the same way).
 *
 * @throws {Error} if an input is not in its canonical form, or the wallet signer rejects or fails.
 */
export async function buildAccessProof(opts: {
  address: string
  challenge: Challenge
  sign: PersonalMessageSigner
  /** The gateway URL the challenge was fetched from (the same string given to `fetchChallenge`). */
  gateway: string
  /** The `Gate` the gateway guards (`0x` + 64 lower-case hex). */
  gateId: string
  network: SuiNetwork
  /** Single-use gateways only: the `consume` transaction digest. */
  consumeDigest?: string
}): Promise<string> {
  const message = personalMessage({
    origin: gatewayOrigin(opts.gateway),
    gateId: opts.gateId,
    network: opts.network,
    nonce: opts.challenge.nonce,
    consumeDigest: opts.consumeDigest,
  })
  const { signature } = await opts.sign(message)
  const proof: AccessProof = { address: opts.address, nonce: opts.challenge.nonce, signature }
  if (opts.consumeDigest !== undefined) proof.consumeDigest = opts.consumeDigest
  return encodeAccessProof(proof)
}
