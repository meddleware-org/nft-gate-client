import { describe, it, expect, vi } from 'vitest'
import {
  parseAdminCap,
  parseGate,
  parsePlatformConfig,
  fetchPlatformConfig,
  fetchAdminCaps,
  fetchGate,
  fetchOwnedGates,
} from '../src/ownership.js'
import type { CoreObject, OwnedObjectsClient, SuiObjectClient } from '../src/types.js'

const PKG = '0xpkg'
const ADMIN_CAP_TYPE = `${PKG}::access_gate::AdminCap`
const GATE_TYPE = `${PKG}::access_gate::Gate`
const GATE_A = '0xgateA'
const GATE_B = '0xgateB'
const CAP_A = '0xcapA'
const CAP_B = '0xcapB'

/** A core-API object (gRPC): id + type top-level, Move struct fields flat under `json`. */
function capObj(adminCapId: string, gateId: string): CoreObject {
  return { objectId: adminCapId, type: ADMIN_CAP_TYPE, json: { id: { id: adminCapId }, gate_id: gateId } }
}

function gateObj(gateId: string, over: Record<string, unknown> = {}): CoreObject {
  return {
    objectId: gateId,
    type: GATE_TYPE,
    json: {
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
  }
}

describe('gate discovery (gRPC core API)', () => {
  it('parseAdminCap reads adminCapId + gate_id', () => {
    expect(parseAdminCap(capObj(CAP_A, GATE_A))).toEqual({ adminCapId: CAP_A, gateId: GATE_A })
  })

  it('parseAdminCap rejects a non-AdminCap object', () => {
    const wrong: CoreObject = { objectId: '0x9', type: `${PKG}::other::Thing`, json: { gate_id: GATE_A } }
    expect(parseAdminCap(wrong)).toBeNull()
  })

  it('parseGate reads all gate fields with correct types', () => {
    const g = parseGate(gateObj(GATE_A))
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
      policy: { freezeRequiresUnpaused: false, lockCommissionOnFreeze: false, pauseBlocksDecryption: false, pauseBlocksAccess: false },
      lockedCommission: null,
      freeFeePaid: false,
    })
  })

  it('parseGate reads a gate policy, locked commission terms and the free-fee flag', () => {
    const g = parseGate(
      gateObj(GATE_A, {
        frozen: true,
        policy: { freeze_requires_unpaused: true, lock_commission_on_freeze: true, pause_blocks_decryption: false, pause_blocks_access: true },
        locked_commission: { bps: '20', min_mist: '1000000' },
        free_fee_paid: true,
      }),
    )
    expect(g?.policy).toEqual({ freezeRequiresUnpaused: true, lockCommissionOnFreeze: true, pauseBlocksDecryption: false, pauseBlocksAccess: true })
    expect(g?.lockedCommission).toEqual({ bps: 20n, minMist: 1_000_000n })
    expect(g?.freeFeePaid).toBe(true)
  })

  it('parseGate accepts the JSON-RPC Option shape for locked_commission', () => {
    const vec = { vec: [{ fields: { bps: '30', min_mist: '5' } }] }
    expect(parseGate(gateObj(GATE_A, { locked_commission: vec }))?.lockedCommission).toEqual({ bps: 30n, minMist: 5n })
    expect(parseGate(gateObj(GATE_A, { locked_commission: { vec: [] } }))?.lockedCommission).toBeNull()
  })

  it('parseGate returns null when fields are missing', () => {
    expect(parseGate({ objectId: GATE_A })).toBeNull()
  })

  it('fetchAdminCaps passes owner + AdminCap type + json include', async () => {
    const listOwnedObjects = vi.fn(async () => ({ objects: [capObj(CAP_A, GATE_A)], hasNextPage: false, cursor: null }))
    const client: OwnedObjectsClient = { core: { listOwnedObjects } }
    const caps = await fetchAdminCaps(client, '0xowner', PKG)
    expect(caps).toEqual([{ adminCapId: CAP_A, gateId: GATE_A }])
    expect(listOwnedObjects).toHaveBeenCalledWith(
      expect.objectContaining({ owner: '0xowner', type: ADMIN_CAP_TYPE, include: { json: true } }),
    )
  })

  it('fetchGate does a typed getObject and parses it', async () => {
    const getObject = vi.fn(async () => ({ object: gateObj(GATE_A) }))
    const client: SuiObjectClient = { core: { getObject } }
    const g = await fetchGate(client, GATE_A)
    expect(g?.gateId).toBe(GATE_A)
    expect(g?.frozen).toBe(false)
    expect(getObject).toHaveBeenCalledWith(
      expect.objectContaining({ objectId: GATE_A, include: { json: true } }),
    )
  })

  it('fetchOwnedGates composes caps → gates and merges adminCapId', async () => {
    const client: OwnedObjectsClient & SuiObjectClient = {
      core: {
        listOwnedObjects: vi.fn(async () => ({
          objects: [capObj(CAP_A, GATE_A), capObj(CAP_B, GATE_B)],
          hasNextPage: false,
          cursor: null,
        })),
        getObject: vi.fn(async ({ objectId }: { objectId: string }) => ({
          object: objectId === GATE_A ? gateObj(GATE_A) : gateObj(GATE_B, { paused: true, frozen: true }),
        })),
      },
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
      core: {
        listOwnedObjects: vi.fn(async () => ({ objects: [capObj(CAP_A, GATE_A)], hasNextPage: false, cursor: null })),
        getObject: vi.fn(async () => ({ object: { objectId: GATE_A } as CoreObject })), // no json ⇒ parseGate null
      },
    }
    expect(await fetchOwnedGates(client, '0xowner', PKG)).toEqual([])
  })
})

describe('PlatformConfig commission', () => {
  const cfgObj: CoreObject = {
    objectId: '0xcfg',
    type: `${PKG}::access_gate::PlatformConfig`,
    json: {
      id: { id: '0xcfg' },
      treasury: '0xtreasury',
      commission_bps: '20',
      min_commission_mist: '1000000',
      free_gate_fee_mist: '100000000',
    },
  }

  it('parsePlatformConfig reads treasury, commission terms and free-gate fee (bare or { object })', () => {
    const want = { treasury: '0xtreasury', commissionBps: 20n, minCommissionMist: 1_000_000n, freeGateFeeMist: 100_000_000n }
    expect(parsePlatformConfig(cfgObj)).toEqual(want)
    expect(parsePlatformConfig({ object: cfgObj })).toEqual(want)
    expect(parsePlatformConfig({ objectId: '0xcfg' })).toBeNull()
  })

  it('fetchPlatformConfig requests json for the given object', async () => {
    const getObject = vi.fn(async () => ({ object: cfgObj }))
    const res = await fetchPlatformConfig({ core: { getObject } }, '0xcfg')
    expect(getObject).toHaveBeenCalledWith({ objectId: '0xcfg', include: { json: true } })
    expect(res?.commissionBps).toBe(20n)
  })
})
