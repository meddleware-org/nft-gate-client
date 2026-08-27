import { describe, it, expect, vi } from 'vitest'
import { parseOwnedAccessNft, fetchAccessNfts, ownsAccessNft, fetchAccessNftById } from '../src/ownership.js'
import type { OwnedObjectsClient, SuiObjectClient } from '../src/types.js'

const NFT_TYPE = '0xpkg::access_gate::AccessNFT'
const GATE_A = '0xgateA'
const GATE_B = '0xgateB'

function entry(objectId: string, gateId: string, uses?: number) {
  return {
    data: {
      objectId,
      type: NFT_TYPE,
      content: {
        dataType: 'moveObject',
        type: NFT_TYPE,
        fields: {
          id: { id: objectId },
          data: {
            fields: {
              gate_id: gateId,
              minted_epoch: '10',
              variant:
                uses === undefined
                  ? { variant: 'UnlimitedPass', fields: {} }
                  : { variant: 'SingleUse', fields: { uses_remaining: String(uses) } },
            },
          },
        },
      },
    },
  }
}

function mockClient(entries: unknown[]): OwnedObjectsClient {
  return {
    getOwnedObjects: vi.fn(async () => ({ data: entries, hasNextPage: false, nextCursor: null })),
  }
}

describe('ownership', () => {
  it('parses an unlimited pass (usesRemaining null)', () => {
    const parsed = parseOwnedAccessNft(entry('0x1', GATE_A))
    expect(parsed).toEqual({ objectId: '0x1', gateId: GATE_A, usesRemaining: null })
  })

  it('parses a single-use NFT with remaining count', () => {
    const parsed = parseOwnedAccessNft(entry('0x2', GATE_A, 3))
    expect(parsed).toEqual({ objectId: '0x2', gateId: GATE_A, usesRemaining: 3 })
  })

  it('returns null for a non-access object', () => {
    expect(parseOwnedAccessNft({ data: { objectId: '0x9', content: { fields: {} } } })).toBeNull()
  })

  it('filters by gate id', async () => {
    const client = mockClient([entry('0x1', GATE_A), entry('0x2', GATE_B, 1)])
    const all = await fetchAccessNfts(client, '0xowner', NFT_TYPE)
    expect(all).toHaveLength(2)
    const onlyA = await fetchAccessNfts(client, '0xowner', NFT_TYPE, GATE_A)
    expect(onlyA).toHaveLength(1)
    expect(onlyA[0].objectId).toBe('0x1')
  })

  it('ownsAccessNft is true only with a matching NFT', async () => {
    expect(await ownsAccessNft(mockClient([entry('0x1', GATE_A)]), '0xo', NFT_TYPE, GATE_A)).toBe(true)
    expect(await ownsAccessNft(mockClient([entry('0x1', GATE_A)]), '0xo', NFT_TYPE, GATE_B)).toBe(false)
    expect(await ownsAccessNft(mockClient([]), '0xo', NFT_TYPE)).toBe(false)
  })

  it('passes the StructType filter to the client', async () => {
    const client = mockClient([])
    await fetchAccessNfts(client, '0xowner', NFT_TYPE)
    expect(client.getOwnedObjects).toHaveBeenCalledWith(
      expect.objectContaining({ owner: '0xowner', filter: { StructType: NFT_TYPE } }),
    )
  })

  it('usesRemaining is driven by the enum variant tag (typed)', () => {
    // UnlimitedPass tag ⇒ null even if a stray field appears
    expect(parseOwnedAccessNft(entry('0x1', GATE_A))?.usesRemaining).toBeNull()
    // SingleUse tag ⇒ exact count
    expect(parseOwnedAccessNft(entry('0x2', GATE_A, 0))?.usesRemaining).toBe(0)
    expect(parseOwnedAccessNft(entry('0x3', GATE_A, 7))?.usesRemaining).toBe(7)
  })

  it('rejects an object whose type is not an access NFT', () => {
    const wrong = {
      data: {
        objectId: '0x9',
        type: '0xpkg::other::Thing',
        content: { type: '0xpkg::other::Thing', fields: { data: { fields: { gate_id: GATE_A } } } },
      },
    }
    expect(parseOwnedAccessNft(wrong)).toBeNull()
  })

  it('fetchAccessNftById does a typed getObject and parses it', async () => {
    const client: SuiObjectClient = {
      getObject: vi.fn(async () => entry('0xnft', GATE_A, 4)),
    }
    const nft = await fetchAccessNftById(client, '0xnft')
    expect(nft).toEqual({ objectId: '0xnft', gateId: GATE_A, usesRemaining: 4 })
    expect(client.getObject).toHaveBeenCalledWith(
      expect.objectContaining({ id: '0xnft', options: { showType: true, showContent: true } }),
    )
  })

  it('supports the soulbound NFT type', () => {
    const sb = entry('0x1', GATE_A, 2)
    sb.data.type = '0xpkg::access_gate::SoulboundAccessNFT'
    sb.data.content.type = '0xpkg::access_gate::SoulboundAccessNFT'
    expect(parseOwnedAccessNft(sb)?.usesRemaining).toBe(2)
  })
})
