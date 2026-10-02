import type { Challenge } from './types.js'
import { isAscii } from './proof.js'

/** Default time limit for the challenge request; a hung gateway must not stall the caller. */
const DEFAULT_TIMEOUT_MS = 10_000
/** A challenge is a nonce and an expiry; anything larger is not a challenge. */
const MAX_CHALLENGE_BYTES = 4096

/** `<gatewayHost>/v1/challenge`, requiring https (http only for a loopback host). */
function challengeUrl(gatewayHost: string): string {
  let url: URL
  try {
    url = new URL(gatewayHost)
  } catch {
    throw new Error(`invalid gateway host: ${gatewayHost}`)
  }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) {
    throw new Error(`gateway host must use https: ${gatewayHost}`)
  }
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/v1/challenge`
  url.search = ''
  url.hash = ''
  return url.toString()
}

/**
 * Fetch a fresh challenge from a gateway's `GET /v1/challenge` endpoint. Tolerates both
 * `expiresAt` (camelCase) and `expires_at` (snake_case) response shapes.
 *
 * The request is aborted after `timeoutMs` (default 10 s) or when `signal` aborts, whichever
 * comes first.
 *
 * @throws {Error} if the host is not an https URL (http is allowed for loopback hosts only).
 * @throws {Error} if the request fails, times out or the gateway returns a non-2xx status.
 * @throws {Error} if the response is oversized, not JSON, or lacks a non-empty ASCII `nonce` or a
 *   numeric expiry.
 */
export async function fetchChallenge(
  gatewayHost: string,
  opts: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<Challenge> {
  const url = challengeUrl(gatewayHost)
  const timeout = AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`challenge request failed: ${res.status}`)
  const text = await res.text()
  if (text.length > MAX_CHALLENGE_BYTES) throw new Error('challenge response too large')
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('challenge response is not JSON')
  }
  const body = (typeof data === 'object' && data !== null ? data : {}) as Record<string, unknown>
  const nonce = body.nonce
  if (typeof nonce !== 'string' || nonce.length === 0 || !isAscii(nonce)) {
    throw new Error('challenge response missing nonce')
  }
  const expiresAt = body.expiresAt ?? body.expires_at ?? 0
  if (typeof expiresAt !== 'number' || !Number.isFinite(expiresAt)) {
    throw new Error('challenge response has an invalid expiry')
  }
  return { nonce, expiresAt }
}
