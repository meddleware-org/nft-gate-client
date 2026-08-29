import { describe, it, expect, vi } from 'vitest'
import {
  parseAdminCap,
  parseGate,
  fetchAdminCaps,
  fetchGate,
  fetchOwnedGates,
} from '../src/ownership.js'
import type { OwnedObjectsClient, SuiObjectClient } from '../src/types.js'

const PKG = '0xpkg'
const ADMIN_CAP_TYPE = `${PKG}::access_gate::AdminCap`
const GATE_A = '0xgateA'
const GATE_B = '0xgateB'
const CAP_A = '0xcapA'
const CAP_B = '0xcapB'

function capEntry(adminCapId: string, gateId: string) {
  return {
    data: {
      objectId: adminCapId,
      type: ADMIN_CAP_TYPE,
      content: {
        dataType: 'moveObject',
        type: ADMIN_CAP_TYPE,
        fields: { id: { id: adminCapId }, gate_id: gateId },
      },
    },
  }
}

function gateEntry(gateId: string, over: Record<string, unknown> = {}) {
  return {
    data: {
      objectId: gateId,
      type: `${PKG}::access_gate::Gate`,
      content: {
        dataType: 'moveObject',
        type: `${PKG}::access_gate::Gate`,
        fields: {
          id: { id: gateId },
          admin_cap_id: '0xcap',
          price_mist: '1000',
          payment_recipient: '0xrecipient',
          default_uses: '3',
          soulbound: true,
          auto_burn_at_zero: false,
          paused: false,
          frozen: false,
          nft_name: 'Test Pass',
          nft_image_url: 'https://x/y.png',
          nft_description: 'desc',
          ...over,
        },
      },
    },
  }
}

describe('gate discovery', () => {
  it('parseAdminCap reads adminCapId + gate_id', () => {
    expect(parseAdminCap(capEntry(CAP_A, GATE_A))).toEqual({ adminCapId: CAP_A, gateId: GATE_A })
  })

  it('parseAdminCap rejects a non-AdminCap object', () => {
    const wrong = { data: { objectId: '0x9', type: `${PKG}::other::Thing`, content: { type: `${PKG}::other::Thing`, fields: { gate_id: GATE_A } } } }
    expect(parseAdminCap(wrong)).toBeNull()
  })

  it('parseGate reads all gate fields with correct types', () => {
    const g = parseGate(gateEntry(GATE_A))
    expect(g).toEqual({
      gateId: GATE_A,
      priceMist: 1000n,
      paymentRecipient: '0xrecipient',
      defaultUses: 3n,
      soulbound: true,
      autoBurnAtZero: false,
      paused: false,
      frozen: false,
      nftName: 'Test Pass',
      nftImageUrl: 'https://x/y.png',
      nftDescription: 'desc',
    })
  })

  it('parseGate returns null when fields are missing', () => {
    expect(parseGate({ data: { objectId: GATE_A } })).toBeNull()
  })

  it('fetchAdminCaps passes the AdminCap StructType filter', async () => {
    const client: OwnedObjectsClient = {
      getOwnedObjects: vi.fn(async () => ({ data: [capEntry(CAP_A, GATE_A)], hasNextPage: false, nextCursor: null })),
    }
    const caps = await fetchAdminCaps(client, '0xowner', PKG)
    expect(caps).toEqual([{ adminCapId: CAP_A, gateId: GATE_A }])
    expect(client.getOwnedObjects).toHaveBeenCalledWith(
      expect.objectContaining({ owner: '0xowner', filter: { StructType: ADMIN_CAP_TYPE } }),
    )
  })

  it('fetchGate does a typed getObject and parses it', async () => {
    const client: SuiObjectClient = { getObject: vi.fn(async () => gateEntry(GATE_A)) }
    const g = await fetchGate(client, GATE_A)
    expect(g?.gateId).toBe(GATE_A)
    expect(g?.frozen).toBe(false)
    expect(client.getObject).toHaveBeenCalledWith(
      expect.objectContaining({ id: GATE_A, options: { showType: true, showContent: true } }),
    )
  })

  it('fetchOwnedGates composes caps → gates and merges adminCapId', async () => {
    const client: OwnedObjectsClient & SuiObjectClient = {
      getOwnedObjects: vi.fn(async () => ({
        data: [capEntry(CAP_A, GATE_A), capEntry(CAP_B, GATE_B)],
        hasNextPage: false,
        nextCursor: null,
      })),
      getObject: vi.fn(async ({ id }) =>
        id === GATE_A ? gateEntry(GATE_A) : gateEntry(GATE_B, { paused: true, frozen: true }),
      ),
    }
    const gates = await fetchOwnedGates(client, '0xowner', PKG)
    expect(gates).toHaveLength(2)
    const a = gates.find((g) => g.gateId === GATE_A)!
    const b = gates.find((g) => g.gateId === GATE_B)!
    expect(a.adminCapId).toBe(CAP_A)
    expect(b.adminCapId).toBe(CAP_B)
    expect(b.paused).toBe(true)
    expect(b.frozen).toBe(true)
  })

  it('fetchOwnedGates skips a gate whose object can no longer be read', async () => {
    const client: OwnedObjectsClient & SuiObjectClient = {
      getOwnedObjects: vi.fn(async () => ({ data: [capEntry(CAP_A, GATE_A)], hasNextPage: false, nextCursor: null })),
      getObject: vi.fn(async () => ({ data: { objectId: GATE_A } })), // no fields ⇒ parseGate null
    }
    expect(await fetchOwnedGates(client, '0xowner', PKG)).toEqual([])
  })
})
