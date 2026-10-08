// Self-test of the published conformance vectors: the library and an independent verifier (the Sui
// SDK) must agree with every case. The gateways run the same file against their own implementations.
import { describe, it, expect } from 'vitest'
import { verifyPersonalMessageSignature } from '@mysten/sui/verify'
import vectors from '../vectors.json' with { type: 'json' }
import { personalMessage, decodeAccessProof, encodeAccessProof } from '../src/proof.js'
import type { AccessMessageContext } from '../src/types.js'

const b64 = (b: Uint8Array) => Buffer.from(b).toString('base64')
const msg = (c: unknown) => personalMessage(c as AccessMessageContext)

async function verifies(address: string, signature: string, context: unknown): Promise<boolean> {
  try {
    await verifyPersonalMessageSignature(msg(context), signature, { address })
    return true
  } catch {
    return false
  }
}

describe('vectors.json', () => {
  it('names the protocol version the library implements', () => {
    expect(vectors.version).toBe('nft-gate:access:v2')
  })

  it.each(vectors.personalMessage.cases)('personalMessage: $name', (c) => {
    expect(new TextDecoder().decode(msg(c.context))).toBe(c.messageUtf8)
    expect(b64(msg(c.context))).toBe(c.messageBytesBase64)
  })

  it.each(vectors.personalMessageRejects)('personalMessage refuses: $name', (c) => {
    expect(() => msg(c.context)).toThrow()
  })

  it('proofDecode', () => {
    expect(decodeAccessProof(vectors.proofDecode.token)).toEqual(vectors.proofDecode.expect)
  })

  it.each(vectors.proofDecodeRejects.cases)('proofDecode refuses: $name', (c) => {
    expect(() => decodeAccessProof(c.token)).toThrow()
  })

  it.each(vectors.signatures)('signature verifies: $scheme', async (v) => {
    expect(await verifies(v.address, v.signature, v.context)).toBe(true)
    expect(decodeAccessProof(v.proofToken).signature).toBe(v.signature)
    expect(encodeAccessProof(decodeAccessProof(v.proofToken))).toBe(v.proofToken)
  })

  it.each(vectors.audienceMismatch)('audience mismatch is refused: $case', async (v) => {
    expect(await verifies(v.address, v.signature, v.context)).toBe(false)
  })

  it.each(vectors.negativeSignatures)('negative signature is refused: $case', async (v) => {
    expect(await verifies(v.address, v.signature, v.context)).toBe(false)
  })
})
