// gRPC read-path integration harness — validates the migrated ownership queries against a REAL
// Sui gRPC full node (default: public testnet). Gated by GRPC_TESTNET so the default offline
// `npm test` skips it; run with:
//
//   GRPC_TESTNET=1 npm run test:integration
//
// Optional env to exercise the domain parsers against real objects:
//   NFT_GATE_TESTNET_GATE_ID   — a real access_gate `Gate` object id → validates parseGate
//   NFT_GATE_TESTNET_OWNER     — an operator address that owns AdminCaps → validates fetchOwnedGates
import { describe, it, expect } from 'vitest'
import { SuiGrpcClient } from '@mysten/sui/grpc'
import { fetchGate, fetchOwnedGates } from '../../src/ownership.js'
import type { OwnedObjectsClient, SuiObjectClient } from '../../src/types.js'

const RUN = !!process.env.GRPC_TESTNET
const BASE_URL = process.env.GRPC_TESTNET_URL || 'https://fullnode.testnet.sui.io:443'
const NETWORK = (process.env.GRPC_TESTNET_NETWORK || 'testnet') as 'testnet' | 'mainnet'

// Meddleware's canonical testnet access_gate deployment (a live shared PlatformConfig object).
const ACCESS_GATE_PKG = '0x1a81ca177db039585e575beeeee4759466e55910e936a6733e38dbb65025eea4'
const PLATFORM_CONFIG = '0xe3b949cabe9a0574c03dfc924fb3f96e6f959f2bb86d053ed6229a241c3a23f7'

describe.skipIf(!RUN)('gRPC read-path (real testnet full node)', () => {
  const client = new SuiGrpcClient({ network: NETWORK, baseUrl: BASE_URL })

  it('core.getObject returns top-level id/type and flat json fields', async () => {
    const { object } = await client.core.getObject({ objectId: PLATFORM_CONFIG, include: { json: true } })
    expect(object.objectId).toBe(PLATFORM_CONFIG)
    expect(object.type).toContain(`${ACCESS_GATE_PKG}::access_gate::PlatformConfig`)
    // The core `json` shape is FLAT (no `.fields` nesting) with scalar values as strings —
    // this is the invariant the migrated parsers rely on.
    expect(object.json).toBeTruthy()
    expect(typeof object.json?.commission_bps).toBe('string')
    expect(String(object.json?.treasury)).toMatch(/^0x[0-9a-f]+$/)
  })

  it('core.listOwnedObjects returns a well-formed page', async () => {
    // Read owned objects for the platform treasury address (may be empty — assert the shape).
    const treasury = String(
      (await client.core.getObject({ objectId: PLATFORM_CONFIG, include: { json: true } })).object.json
        ?.treasury,
    )
    const page = await client.core.listOwnedObjects({ owner: treasury, include: { json: true } })
    expect(Array.isArray(page.objects)).toBe(true)
    expect(typeof page.hasNextPage).toBe('boolean')
  })

  it.skipIf(!process.env.NFT_GATE_TESTNET_GATE_ID)(
    'fetchGate parses a real Gate object',
    async () => {
      const gate = await fetchGate(client as unknown as SuiObjectClient, process.env.NFT_GATE_TESTNET_GATE_ID!)
      expect(gate).not.toBeNull()
      expect(typeof gate!.priceMist).toBe('bigint')
      expect(typeof gate!.soulbound).toBe('boolean')
      expect(typeof gate!.nftName).toBe('string')
    },
  )

  it.skipIf(!process.env.NFT_GATE_TESTNET_OWNER)(
    'fetchOwnedGates lists an operator\'s gates',
    async () => {
      const gates = await fetchOwnedGates(
        client as unknown as OwnedObjectsClient & SuiObjectClient,
        process.env.NFT_GATE_TESTNET_OWNER!,
        ACCESS_GATE_PKG,
      )
      expect(Array.isArray(gates)).toBe(true)
      for (const g of gates) expect(g.adminCapId).toMatch(/^0x[0-9a-f]+$/)
    },
  )
})
