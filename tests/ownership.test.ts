import { describe, it, expect, vi } from 'vitest'
import { parseOwnedAccessNft, fetchAccessNfts, ownsAccessNft, fetchAccessNftById } from '../src/ownership.js'
import type { CoreObject, OwnedObjectsClient, SuiObjectClient } from '../src/types.js'

const NFT_TYPE = '0xpkg::access_gate::AccessNFT'
const GATE_A = '0xgateA'
const GATE_B = '0xgateB'

/** A core-API owned object (gRPC): id + type top-level, Move struct fields flat under `json`. */
function coreObj(objectId: string, gateId: string, uses?: number): CoreObject {
  return {
    objectId,
    type: NFT_TYPE,
    json: {
      id: { id: objectId },
      data: {
        gate_id: gateId,
        minted_epoch: '10',
        variant:
          uses === undefined
            ? { variant: 'UnlimitedPass', fields: {} }
            : { variant: 'SingleUse', fields: { uses_remaining: String(uses) } },
      },
    },
  }
}

function mockClient(objects: CoreObject[]): OwnedObjectsClient {
  return {
    core: {
      listOwnedObjects: vi.fn(async () => ({ objects, hasNextPage: false, cursor: null })),
    },
  }
}

describe('ownership (gRPC core API)', () => {
  it('parses an unlimited pass (usesRemaining null)', () => {
    const parsed = parseOwnedAccessNft(coreObj('0x1', GATE_A))
    expect(parsed).toEqual({ objectId: '0x1', gateId: GATE_A, usesRemaining: null })
  })

  it('parses a single-use NFT with remaining count', () => {
    const parsed = parseOwnedAccessNft(coreObj('0x2', GATE_A, 3))
    expect(parsed).toEqual({ objectId: '0x2', gateId: GATE_A, usesRemaining: 3 })
  })

  it('returns null for a non-access object', () => {
    expect(parseOwnedAccessNft({ objectId: '0x9', json: {} })).toBeNull()
  })

  it('filters by gate id', async () => {
    const client = mockClient([coreObj('0x1', GATE_A), coreObj('0x2', GATE_B, 1)])
    const all = await fetchAccessNfts(client, '0xowner', NFT_TYPE)
    expect(all).toHaveLength(2)
    const onlyA = await fetchAccessNfts(client, '0xowner', NFT_TYPE, GATE_A)
    expect(onlyA).toHaveLength(1)
    expect(onlyA[0].objectId).toBe('0x1')
  })

  it('ownsAccessNft is true only with a matching NFT', async () => {
    expect(await ownsAccessNft(mockClient([coreObj('0x1', GATE_A)]), '0xo', NFT_TYPE, GATE_A)).toBe(true)
    expect(await ownsAccessNft(mockClient([coreObj('0x1', GATE_A)]), '0xo', NFT_TYPE, GATE_B)).toBe(false)
    expect(await ownsAccessNft(mockClient([]), '0xo', NFT_TYPE)).toBe(false)
  })

  it('passes owner + type + json include to the core client', async () => {
    const client = mockClient([])
    await fetchAccessNfts(client, '0xowner', NFT_TYPE)
    expect(client.core.listOwnedObjects).toHaveBeenCalledWith(
      expect.objectContaining({ owner: '0xowner', type: NFT_TYPE, include: { json: true } }),
    )
  })

  it('usesRemaining is driven by the enum variant tag (typed)', () => {
    expect(parseOwnedAccessNft(coreObj('0x1', GATE_A))?.usesRemaining).toBeNull()
    expect(parseOwnedAccessNft(coreObj('0x2', GATE_A, 0))?.usesRemaining).toBe(0)
    expect(parseOwnedAccessNft(coreObj('0x3', GATE_A, 7))?.usesRemaining).toBe(7)
  })

  it('tolerates the nested `.fields` shape (transport robustness)', () => {
    const nested: CoreObject = {
      objectId: '0xn',
      type: NFT_TYPE,
      json: { fields: { data: { fields: { gate_id: GATE_A, variant: { variant: 'SingleUse', fields: { uses_remaining: '5' } } } } } },
    }
    expect(parseOwnedAccessNft(nested)).toEqual({ objectId: '0xn', gateId: GATE_A, usesRemaining: 5 })
  })

  it('rejects an object whose type is not an access NFT', () => {
    const wrong: CoreObject = {
      objectId: '0x9',
      type: '0xpkg::other::Thing',
      json: { data: { gate_id: GATE_A } },
    }
    expect(parseOwnedAccessNft(wrong)).toBeNull()
  })

  it('fetchAccessNftById does a typed getObject and parses it', async () => {
    const getObject = vi.fn(async () => ({ object: coreObj('0xnft', GATE_A, 4) }))
    const client: SuiObjectClient = { core: { getObject } }
    const nft = await fetchAccessNftById(client, '0xnft')
    expect(nft).toEqual({ objectId: '0xnft', gateId: GATE_A, usesRemaining: 4 })
    expect(getObject).toHaveBeenCalledWith(
      expect.objectContaining({ objectId: '0xnft', include: { json: true } }),
    )
  })

  it('supports the soulbound NFT type', () => {
    const sb = coreObj('0x1', GATE_A, 2)
    sb.type = '0xpkg::access_gate::SoulboundAccessNFT'
    expect(parseOwnedAccessNft(sb)?.usesRemaining).toBe(2)
  })
})
