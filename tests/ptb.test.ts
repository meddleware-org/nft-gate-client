import { describe, it, expect } from 'vitest'
import { buildPurchaseTx, buildConsumeTx, buildCreateGateTx } from '../src/ptb.js'
import type { AccessGateConfig } from '../src/types.js'

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
