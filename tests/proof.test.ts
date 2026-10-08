import { describe, it, expect, vi } from 'vitest'
import {
  ACCESS_MESSAGE_VERSION,
  personalMessage,
  gatewayOrigin,
  encodeAccessProof,
  decodeAccessProof,
  buildAccessProof,
  isTransactionDigest,
  isNonce,
} from '../src/proof.js'
import type { AccessMessageContext } from '../src/types.js'

const DIGEST = '5Wq9tE4gXz8hEvFhYt8KkTJb2Pp6qXqj8cRk3xN1mYdL'
const CTX: AccessMessageContext = {
  origin: 'https://gateway.example',
  gateId: '0x' + 'a1'.repeat(32),
  network: 'testnet',
  nonce: 'GOLDEN-NONCE-123',
}
const text = (b: Uint8Array) => new TextDecoder().decode(b)

describe('personalMessage', () => {
  it('is the documented multi-line ASCII message', () => {
    expect(text(personalMessage(CTX))).toBe(
      [ACCESS_MESSAGE_VERSION, 'origin:https://gateway.example', `gate:${CTX.gateId}`, 'network:testnet', 'nonce:GOLDEN-NONCE-123'].join('\n'),
    )
  })

  it('appends the consume line for single-use gateways only', () => {
    expect(text(personalMessage({ ...CTX, consumeDigest: DIGEST })).split('\n').at(-1)).toBe(`consume:${DIGEST}`)
    expect(text(personalMessage(CTX))).not.toContain('consume')
  })

  it('refuses non-canonical fields, which also blocks line injection', () => {
    for (const bad of [
      { origin: 'http://gateway.example' },
      { origin: 'https://Gateway.example' },
      { origin: 'https://gateway.example/' },
      { gateId: '0x1' },
      { gateId: '0x' + 'A1'.repeat(32) },
      { network: 'testnet2' as never },
      { nonce: 'n\nconsume:x' },
      { nonce: '' },
      { consumeDigest: 'DIGEST-1' },
    ]) {
      expect(() => personalMessage({ ...CTX, ...bad })).toThrow()
    }
  })
})

describe('gatewayOrigin', () => {
  it('canonicalises, and allows http on loopback only', () => {
    expect(gatewayOrigin('https://Gateway.example:443/relay/?x=1#y')).toBe('https://gateway.example')
    expect(gatewayOrigin('http://127.0.0.1:8787/')).toBe('http://127.0.0.1:8787')
    expect(() => gatewayOrigin('http://gateway.example')).toThrow(/https/)
    expect(() => gatewayOrigin('https://user:pw@gateway.example')).toThrow(/credentials/)
    expect(() => gatewayOrigin('gateway.example')).toThrow(/invalid gateway URL/)
  })
})

describe('access proof token', () => {
  const proof = { address: '0xabc', nonce: 'GOLDEN-NONCE-123', signature: 'U0lHTkFUVVJF' }

  it('round-trips, with and without a consume digest', () => {
    expect(decodeAccessProof(encodeAccessProof(proof))).toEqual(proof)
    const single = { ...proof, consumeDigest: DIGEST }
    expect(decodeAccessProof(encodeAccessProof(single))).toEqual(single)
  })

  it('is btoa(JSON) with the documented key order', () => {
    expect(encodeAccessProof(proof)).toBe(btoa(JSON.stringify(proof)))
  })

  it('applies the same rules when encoding as when decoding', () => {
    for (const bad of [
      { ...proof, address: '' },
      { ...proof, address: 'abc' },
      { ...proof, nonce: 'a b' },
      { ...proof, nonce: 'nönce' },
      { ...proof, signature: '***' },
      { ...proof, consumeDigest: 'DIGEST-1' },
    ]) {
      expect(() => encodeAccessProof(bad)).toThrow()
    }
  })

  it('rejects malformed tokens', () => {
    expect(() => decodeAccessProof('not-base64-json!!')).toThrow()
    expect(() => decodeAccessProof(btoa(JSON.stringify({ address: '0x1' })))).toThrow(/malformed/)
    expect(() => decodeAccessProof(btoa('null'))).toThrow(/malformed/)
    expect(() => decodeAccessProof(btoa('[]'))).toThrow(/malformed/)
    expect(() => decodeAccessProof('A'.repeat(4097))).toThrow(/too large/)
  })
})

describe('buildAccessProof', () => {
  const challenge = { nonce: 'xyz', expiresAt: Date.now() + 1000 }
  const base = { address: '0xabc', challenge, gateway: 'https://gateway.example/', gateId: CTX.gateId, network: 'testnet' as const }

  it('signs the audience-bound message and returns the token', async () => {
    const sign = vi.fn(async (message: Uint8Array) => {
      expect(text(message)).toBe(text(personalMessage({ ...CTX, nonce: 'xyz' })))
      return { signature: 'QkFTRTY0' }
    })
    const token = await buildAccessProof({ ...base, sign })
    expect(sign).toHaveBeenCalledOnce()
    expect(decodeAccessProof(token)).toEqual({ address: '0xabc', nonce: 'xyz', signature: 'QkFTRTY0' })
  })

  it('binds the consume digest into both the message and the proof', async () => {
    const sign = vi.fn(async (message: Uint8Array) => {
      expect(text(message).endsWith(`\nconsume:${DIGEST}`)).toBe(true)
      return { signature: 'QkFTRTY0' }
    })
    const token = await buildAccessProof({ ...base, sign, consumeDigest: DIGEST })
    expect(decodeAccessProof(token).consumeDigest).toBe(DIGEST)
  })

  it('refuses malformed inputs before asking the wallet to sign', async () => {
    const sign = vi.fn(async () => ({ signature: 'QQ==' }))
    for (const bad of [{ consumeDigest: 'digest1' }, { gateId: '0x1' }, { gateway: 'http://gateway.example' }]) {
      await expect(buildAccessProof({ ...base, sign, ...bad })).rejects.toThrow()
    }
    expect(sign).not.toHaveBeenCalled()
  })
})

describe('shape predicates', () => {
  it('isTransactionDigest accepts base58 digests only', () => {
    expect(isTransactionDigest(DIGEST)).toBe(true)
    expect(isTransactionDigest('0OIl'.repeat(10))).toBe(false)
    expect(isTransactionDigest('')).toBe(false)
  })
  it('isNonce accepts the challenge alphabet only', () => {
    expect(isNonce('aZ09._~-')).toBe(true)
    for (const bad of ['', 'a b', 'a\nb', 'nönce', 'a'.repeat(129)]) expect(isNonce(bad)).toBe(false)
  })
})
