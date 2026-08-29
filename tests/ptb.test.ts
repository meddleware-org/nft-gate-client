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

  it('buildCreateGateTx targets create_gate with display metadata', () => {
    const json = commandsJson(
      buildCreateGateTx(PKG, {
        priceMist: 0n,
        paymentRecipient: RECIPIENT,
        defaultUses: 0n,
        soulbound: true,
        autoBurnAtZero: false,
        nftName: 'Test Pass',
        nftImageUrl: 'https://example.com/image.png',
        nftDescription: 'A test access pass.',
      }),
    )
    expect(json).toContain('"function":"create_gate"')
    // 8 inputs: price, recipient, defaultUses, soulbound, autoBurnAtZero, nftName, nftImageUrl, nftDescription
    const inputRefs = json.match(/"Input":\d+/g) ?? []
    expect(inputRefs.length).toBe(8)
  })
})

const ADMIN_CAP = '0x00000000000000000000000000000000000000000000000000000000000000d4'
const adminCtx: GateAdminContext = { packageId: PKG, gateId: GATE, adminCapId: ADMIN_CAP }

describe('gate-admin PTB builders', () => {
  // Each admin builder must call the named entry with [adminCap, gate, ...] as the first two args.
  const cases: Array<{ name: string; fn: string; tx: () => { getData: () => unknown }; inputs: number }> = [
    { name: 'buildSetPriceTx', fn: 'set_price', tx: () => buildSetPriceTx(adminCtx, 1000n), inputs: 3 },
    { name: 'buildSetPaymentRecipientTx', fn: 'set_payment_recipient', tx: () => buildSetPaymentRecipientTx(adminCtx, RECIPIENT), inputs: 3 },
    { name: 'buildSetPausedTx', fn: 'set_paused', tx: () => buildSetPausedTx(adminCtx, true), inputs: 3 },
    { name: 'buildSetDefaultUsesTx', fn: 'set_default_uses', tx: () => buildSetDefaultUsesTx(adminCtx, 5n), inputs: 3 },
    { name: 'buildSetSoulboundTx', fn: 'set_soulbound', tx: () => buildSetSoulboundTx(adminCtx, true), inputs: 3 },
    { name: 'buildSetAutoBurnAtZeroTx', fn: 'set_auto_burn_at_zero', tx: () => buildSetAutoBurnAtZeroTx(adminCtx, false), inputs: 3 },
    { name: 'buildSetNftNameTx', fn: 'set_nft_name', tx: () => buildSetNftNameTx(adminCtx, 'Name'), inputs: 3 },
    { name: 'buildSetNftImageUrlTx', fn: 'set_nft_image_url', tx: () => buildSetNftImageUrlTx(adminCtx, 'https://x/y.png'), inputs: 3 },
    { name: 'buildSetNftDescriptionTx', fn: 'set_nft_description', tx: () => buildSetNftDescriptionTx(adminCtx, 'desc'), inputs: 3 },
    { name: 'buildAirdropTx', fn: 'airdrop', tx: () => buildAirdropTx(adminCtx, RECIPIENT), inputs: 3 },
    { name: 'buildMakeGateImmutableTx', fn: 'make_gate_immutable', tx: () => buildMakeGateImmutableTx(adminCtx), inputs: 2 },
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
})
