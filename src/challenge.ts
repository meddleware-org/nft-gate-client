import type { Challenge } from './types.js'

/**
 * Fetch a fresh challenge from a gateway's `GET /v1/challenge` endpoint. Tolerates both
 * `expiresAt` (camelCase) and `expires_at` (snake_case) response shapes.
 */
export async function fetchChallenge(
  gatewayHost: string,
  opts: { signal?: AbortSignal } = {},
): Promise<Challenge> {
  const res = await fetch(`${gatewayHost.replace(/\/$/, '')}/v1/challenge`, {
    signal: opts.signal,
  })
  if (!res.ok) throw new Error(`challenge request failed: ${res.status}`)
  const data = (await res.json()) as { nonce?: string; expiresAt?: number; expires_at?: number }
  if (!data || typeof data.nonce !== 'string') throw new Error('challenge response missing nonce')
  const expiresAt = data.expiresAt ?? data.expires_at ?? 0
  return { nonce: data.nonce, expiresAt }
}
