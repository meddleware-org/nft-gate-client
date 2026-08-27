import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchChallenge } from '../src/challenge.js'

afterEach(() => vi.restoreAllMocks())

describe('fetchChallenge', () => {
  it('parses camelCase expiresAt', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ nonce: 'abc', expiresAt: 123 }), { status: 200 })),
    )
    expect(await fetchChallenge('https://gw.example')).toEqual({ nonce: 'abc', expiresAt: 123 })
  })

  it('parses snake_case expires_at and strips trailing slash', async () => {
    const spy = vi.fn(async () => new Response(JSON.stringify({ nonce: 'n2', expires_at: 456 }), { status: 200 }))
    vi.stubGlobal('fetch', spy)
    const res = await fetchChallenge('https://gw.example/')
    expect(res).toEqual({ nonce: 'n2', expiresAt: 456 })
    expect(spy).toHaveBeenCalledWith('https://gw.example/v1/challenge', expect.anything())
  })

  it('throws on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 503 })))
    await expect(fetchChallenge('https://gw.example')).rejects.toThrow(/503/)
  })

  it('throws when nonce is missing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ expiresAt: 1 }), { status: 200 })))
    await expect(fetchChallenge('https://gw.example')).rejects.toThrow(/nonce/)
  })
})
