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

describe('fetchChallenge hardening', () => {
  const ok = (body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }))

  it('keeps a path prefix and drops query and fragment', async () => {
    const spy = ok({ nonce: 'n', expiresAt: 1 })
    vi.stubGlobal('fetch', spy)
    await fetchChallenge('https://gw.example/relay/?x=1#y')
    expect(spy).toHaveBeenCalledWith('https://gw.example/relay/v1/challenge', expect.anything())
  })

  it('refuses a plain-http or malformed host, but allows http on loopback', async () => {
    vi.stubGlobal('fetch', ok({ nonce: 'n', expiresAt: 1 }))
    await expect(fetchChallenge('http://gw.example')).rejects.toThrow(/https/)
    await expect(fetchChallenge('gw.example')).rejects.toThrow(/invalid gateway host/)
    await expect(fetchChallenge('http://127.0.0.1:8787')).resolves.toEqual({ nonce: 'n', expiresAt: 1 })
  })

  it('always passes an abort signal, and times out a hung gateway', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise<Response>((_, reject) => init.signal!.addEventListener('abort', () => reject(init.signal!.reason))),
      ),
    )
    await expect(fetchChallenge('https://gw.example', { timeoutMs: 20 })).rejects.toThrow(/timed out|abort/i)
  })

  it("honours the caller's signal", async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise<Response>((_, reject) => init.signal!.addEventListener('abort', () => reject(new Error('aborted')))),
      ),
    )
    const ctl = new AbortController()
    const p = fetchChallenge('https://gw.example', { signal: ctl.signal })
    ctl.abort()
    await expect(p).rejects.toThrow(/aborted/)
  })

  it('rejects oversized, non-JSON and badly typed responses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('x'.repeat(5000), { status: 200 })))
    await expect(fetchChallenge('https://gw.example')).rejects.toThrow(/too large/)
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>', { status: 200 })))
    await expect(fetchChallenge('https://gw.example')).rejects.toThrow(/not JSON/)
    vi.stubGlobal('fetch', ok({ nonce: '', expiresAt: 1 }))
    await expect(fetchChallenge('https://gw.example')).rejects.toThrow(/nonce/)
    vi.stubGlobal('fetch', ok({ nonce: 'nönce', expiresAt: 1 }))
    await expect(fetchChallenge('https://gw.example')).rejects.toThrow(/nonce/)
    vi.stubGlobal('fetch', ok({ nonce: 'n', expiresAt: '1' }))
    await expect(fetchChallenge('https://gw.example')).rejects.toThrow(/expiry/)
    vi.stubGlobal('fetch', ok(null))
    await expect(fetchChallenge('https://gw.example')).rejects.toThrow(/nonce/)
  })
})
