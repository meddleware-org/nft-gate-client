import { describe, it, expect } from 'vitest'
import {
  buildPurchaseTx,
  buildConsumeTx,
  buildCreateGateTx,
  buildSetPriceTx,
  buildSetPaymentRecipientTx,
  buildSetPausedTx,
  buildSetDefaultUsesTx,
  buildSetSoulboundTx,
  buildSetAutoBurnAtZeroTx,
  buildSetNftNameTx,
  buildSetNftImageUrlTx,
  buildSetNftDescriptionTx,
  buildAirdropTx,
  buildMakeGateImmutableTx,
  buildMakeGateFreeTx,
  DEFAULT_GATE_POLICY,
  isRestrictivePolicy,
  commissionForPrice,
  minimumPaidPriceMist,
  gateCommissionMist,
} from '../src/ptb.js'
import type { AccessGateConfig, GateAdminContext } from '../src/types.js'

// Valid 32-byte hex addresses (moveCall/object validate their inputs).
const PKG = '0x00000000000000000000000000000000000000000000000000000000000000aa'
const GATE = '0x00000000000000000000000000000000000000000000000000000000000000a1'
const PLATFORM = '0x00000000000000000000000000000000000000000000000000000000000000a2'
const NFT = '0x00000000000000000000000000000000000000000000000000000000000000b2'
const RECIPIENT = '0x00000000000000000000000000000000000000000000000000000000000000c3'

const cfg: AccessGateConfig = {
  packageId: PKG,
  gateId: GATE,
  platformConfigId: PLATFORM,
  nftType: `${PKG}::access_gate::AccessNFT`,
  soulbound: false,
}

function commandsJson(tx: { getData: () => unknown }): string {
  return JSON.stringify(tx.getData())
}

describe('ptb builders', () => {
  it('buildPurchaseTx targets access_gate::purchase and splits gas', () => {
    const json = commandsJson(buildPurchaseTx(cfg, 500n))
    expect(json).toContain('"function":"purchase"')
    expect(json).toContain('"module":"access_gate"')
    expect(json).toContain('SplitCoins')
    // gate, platformConfig, payment — three args
    expect(json).toContain(GATE.slice(2))
    expect(json).toContain(PLATFORM.slice(2))
  })

  it('buildConsumeTx targets consume for transferable gates', () => {
    const json = commandsJson(buildConsumeTx(cfg, NFT, 'nonce-1'))
    expect(json).toContain('"function":"consume"')
    expect(json).not.toContain('consume_soulbound')
  })

  it('buildConsumeTx targets consume_soulbound for soulbound gates', () => {
    const json = commandsJson(buildConsumeTx({ ...cfg, soulbound: true }, NFT, 'nonce-1'))
    expect(json).toContain('"function":"consume_soulbound"')
  })

  const gateOpts = {
    priceMist: 10_000_000n,
    paymentRecipient: RECIPIENT,
    defaultUses: 1n,
    soulbound: false,
    autoBurnAtZero: true,
    nftName: 'Pass',
    nftImageUrl: 'https://example.com/i.png',
    nftDescription: 'd',
  }

  it('buildCreateGateTx: paid gate → new_gate_policy + create_gate(platform, price, …, policy)', () => {
    const json = commandsJson(buildCreateGateTx(PKG, PLATFORM, gateOpts))
    expect(json).toContain('"function":"new_gate_policy"')
    expect(json).toContain('"function":"create_gate"')
    expect(json).not.toContain('create_free_gate')
    expect(json).not.toContain('SplitCoins')
    expect(json).toContain(PLATFORM.slice(2))
    // 4 policy flags + platform + price + 7 gate values; the policy is command 0's result.
    expect((json.match(/"Input":\d+/g) ?? []).length).toBe(13)
    expect(json).toContain('"NestedResult":[0,0]')
  })

  it('buildCreateGateTx: price 0 → splits the free-gate fee and calls create_free_gate', () => {
    const json = commandsJson(buildCreateGateTx(PKG, PLATFORM, { ...gateOpts, priceMist: 0n, freeGateFeeMist: 100_000_000n }))
    expect(json).toContain('"function":"create_free_gate"')
    expect(json).toContain('SplitCoins')
    expect(json).not.toContain('"function":"create_gate"')
  })

  it('buildCreateGateTx: price 0 without freeGateFeeMist throws', () => {
    expect(() => buildCreateGateTx(PKG, PLATFORM, { ...gateOpts, priceMist: 0n })).toThrow(/freeGateFeeMist/)
  })

  it('buildCreateGateTx passes the policy flags through', () => {
    const tx = buildCreateGateTx(PKG, PLATFORM, {
      ...gateOpts,
      policy: { freezeRequiresUnpaused: true, lockCommissionOnFreeze: false, pauseBlocksDecryption: true, pauseBlocksAccess: true },
    })
    const data = tx.getData() as { inputs: Array<{ Pure?: { bytes: string } }> }
    // The first four inputs are the policy bools, in order: true, false, true, true (BCS 1/0).
    expect(data.inputs.slice(0, 4).map((i) => i.Pure?.bytes)).toEqual(['AQ==', 'AA==', 'AQ==', 'AQ=='])
  })
})

describe('policy + commission helpers', () => {
  it('isRestrictivePolicy is false only for the all-false policy', () => {
    expect(isRestrictivePolicy(DEFAULT_GATE_POLICY)).toBe(false)
    expect(isRestrictivePolicy({ ...DEFAULT_GATE_POLICY, pauseBlocksAccess: true })).toBe(true)
  })

  const terms = { bps: 20n, minMist: 1_000_000n }

  it('commissionForPrice mirrors the contract: max(bps share, floor), capped at 10%', () => {
    expect(commissionForPrice(0n, terms)).toBe(0n)
    expect(commissionForPrice(10_000_000n, terms)).toBe(1_000_000n) // floor
    expect(commissionForPrice(5_000_000n, terms)).toBe(500_000n) // capped at 10%
    expect(commissionForPrice(1_000_000_000n, terms)).toBe(2_000_000n) // 0.2%
    expect(commissionForPrice(499n, { bps: 20n, minMist: 0n })).toBe(0n) // dust without a floor
  })

  it('minimumPaidPriceMist is 10 × the floor (at least 1)', () => {
    expect(minimumPaidPriceMist(0n)).toBe(1n)
    expect(minimumPaidPriceMist(1n)).toBe(10n)
    expect(minimumPaidPriceMist(1_000_000n)).toBe(10_000_000n)
    expect(commissionForPrice(minimumPaidPriceMist(1_000_000n), terms)).toBe(1_000_000n)
  })

  it('gateCommissionMist prefers the gate’s locked terms over the live platform terms', () => {
    const platform = { treasury: '0x1', commissionBps: 20n, minCommissionMist: 5_000_000n, freeGateFeeMist: 0n }
    expect(gateCommissionMist({ priceMist: 100_000_000n, lockedCommission: null }, platform)).toBe(5_000_000n)
    expect(gateCommissionMist({ priceMist: 100_000_000n, lockedCommission: terms }, platform)).toBe(1_000_000n)
  })
})

const ADMIN_CAP = '0x00000000000000000000000000000000000000000000000000000000000000d4'
const adminCtx: GateAdminContext = { packageId: PKG, gateId: GATE, adminCapId: ADMIN_CAP, platformConfigId: PLATFORM }

describe('gate-admin PTB builders', () => {
  // Each admin builder must call the named entry with [adminCap, gate, ...] as the first two args.
  const cases: Array<{ name: string; fn: string; tx: () => { getData: () => unknown }; inputs: number }> = [
    { name: 'buildSetPriceTx', fn: 'set_price', tx: () => buildSetPriceTx(adminCtx, 10_000_000n), inputs: 4 },
    { name: 'buildSetPaymentRecipientTx', fn: 'set_payment_recipient', tx: () => buildSetPaymentRecipientTx(adminCtx, RECIPIENT), inputs: 3 },
    { name: 'buildSetPausedTx', fn: 'set_paused', tx: () => buildSetPausedTx(adminCtx, true), inputs: 3 },
    { name: 'buildSetDefaultUsesTx', fn: 'set_default_uses', tx: () => buildSetDefaultUsesTx(adminCtx, 5n), inputs: 3 },
    { name: 'buildSetSoulboundTx', fn: 'set_soulbound', tx: () => buildSetSoulboundTx(adminCtx, true), inputs: 3 },
    { name: 'buildSetAutoBurnAtZeroTx', fn: 'set_auto_burn_at_zero', tx: () => buildSetAutoBurnAtZeroTx(adminCtx, false), inputs: 3 },
    { name: 'buildSetNftNameTx', fn: 'set_nft_name', tx: () => buildSetNftNameTx(adminCtx, 'Name'), inputs: 3 },
    { name: 'buildSetNftImageUrlTx', fn: 'set_nft_image_url', tx: () => buildSetNftImageUrlTx(adminCtx, 'https://x/y.png'), inputs: 3 },
    { name: 'buildSetNftDescriptionTx', fn: 'set_nft_description', tx: () => buildSetNftDescriptionTx(adminCtx, 'desc'), inputs: 3 },
    { name: 'buildAirdropTx', fn: 'airdrop', tx: () => buildAirdropTx(adminCtx, RECIPIENT, 1_000_000n), inputs: 5 },
    { name: 'buildMakeGateFreeTx', fn: 'make_gate_free', tx: () => buildMakeGateFreeTx(adminCtx, 100_000_000n), inputs: 4 },
    { name: 'buildMakeGateImmutableTx', fn: 'make_gate_immutable', tx: () => buildMakeGateImmutableTx(adminCtx), inputs: 3 },
  ]

  for (const c of cases) {
    it(`${c.name} targets access_gate::${c.fn} with cap + gate + ${c.inputs - 2} value(s)`, () => {
      const json = commandsJson(c.tx())
      expect(json).toContain(`"function":"${c.fn}"`)
      expect(json).toContain('"module":"access_gate"')
      // adminCap + gate are always present
      expect(json).toContain(ADMIN_CAP.slice(2))
      expect(json).toContain(GATE.slice(2))
      const inputRefs = json.match(/"Input":\d+/g) ?? []
      expect(inputRefs.length).toBe(c.inputs)
    })
  }

  it('builders that read PlatformConfig pass it', () => {
    for (const tx of [buildSetPriceTx(adminCtx, 10_000_000n), buildAirdropTx(adminCtx, RECIPIENT, 0n), buildMakeGateFreeTx(adminCtx, 0n), buildMakeGateImmutableTx(adminCtx)]) {
      expect(commandsJson(tx)).toContain(PLATFORM.slice(2))
    }
  })
})
