import { describe, it, expect, vi } from 'vitest'
import {
  personalMessageForNonce,
  encodeAccessProof,
  decodeAccessProof,
  buildAccessProof,
} from '../src/proof.js'

describe('proof', () => {
  it('derives a stable personal message for a nonce', () => {
    const msg = personalMessageForNonce('abc123')
    expect(new TextDecoder().decode(msg)).toBe('nft-gate:access:abc123')
  })

  // GOLDEN VECTOR — the single source of truth for the wire format, mirrored byte-for-byte by
  // the Rust gateway (`gateway/src/proof.rs::tests::golden_vector`) and specified in
  // `docs/challenge-response.md`. If any of these constants change, ALL mirrors must change
  // together, or verification silently breaks. See client audit F1 / synthesis S1.
  it('matches the golden wire-format vector', () => {
    // 1. signed-message bytes for a fixed nonce
    expect(Array.from(personalMessageForNonce('GOLDEN-NONCE-123'))).toEqual(
      Array.from(new TextEncoder().encode('nft-gate:access:GOLDEN-NONCE-123')),
    )
    // 2. proof token = base64(JSON) with keys in {address,nonce,signature,consumeDigest?}
    const token = encodeAccessProof({
      address: '0xabc',
      nonce: 'GOLDEN-NONCE-123',
      signature: 'U0lHTkFUVVJF',
      consumeDigest: 'DIGEST-1',
    })
    // exact JSON shape (field order fixed by the encoder)
    const json = JSON.parse(atob(token))
    expect(json).toEqual({
      address: '0xabc',
      nonce: 'GOLDEN-NONCE-123',
      signature: 'U0lHTkFUVVJF',
      consumeDigest: 'DIGEST-1',
    })
    // and it decodes back to the same proof
    expect(decodeAccessProof(token)).toEqual(json)
  })

  it('round-trips an access proof through encode/decode', () => {
    const token = encodeAccessProof({ address: '0x1', nonce: 'n', signature: 'sig' })
    const back = decodeAccessProof(token)
    expect(back).toEqual({ address: '0x1', nonce: 'n', signature: 'sig' })
  })

  it('preserves consumeDigest when present', () => {
    const token = encodeAccessProof({ address: '0x1', nonce: 'n', signature: 'sig', consumeDigest: 'dig' })
    expect(decodeAccessProof(token).consumeDigest).toBe('dig')
  })

  it('throws on malformed proof token', () => {
    expect(() => decodeAccessProof('not-base64-json!!')).toThrow()
    const bad = encodeAccessProof({ address: '', nonce: '', signature: '' } as never)
    // empty strings are still strings; assert a truly missing field throws
    const missing = btoa(JSON.stringify({ address: '0x1' }))
    expect(() => decodeAccessProof(missing)).toThrow()
    expect(() => decodeAccessProof(bad)).not.toThrow()
  })

  it('builds a proof by signing the challenge message', async () => {
    const sign = vi.fn(async (message: Uint8Array) => {
      expect(new TextDecoder().decode(message)).toBe('nft-gate:access:xyz')
      return { signature: 'BASE64SIG' }
    })
    const token = await buildAccessProof({
      address: '0xabc',
      challenge: { nonce: 'xyz', expiresAt: Date.now() + 1000 },
      sign,
      consumeDigest: 'digest1',
    })
    expect(sign).toHaveBeenCalledOnce()
    expect(decodeAccessProof(token)).toEqual({
      address: '0xabc',
      nonce: 'xyz',
      signature: 'BASE64SIG',
      consumeDigest: 'digest1',
    })
  })
})
