import { Transaction } from '@mysten/sui/transactions'
import type { AccessGateConfig } from './types.js'

/**
 * Build a PTB that purchases access: split `priceMist` from the gas coin and call
 * `access_gate::purchase(gate, payment)`. Overpayment is refunded on-chain, so the split
 * must be exactly the price. The caller signs + executes with their wallet.
 */
export function buildPurchaseTx(cfg: AccessGateConfig, priceMist: bigint | number): Transaction {
  const tx = new Transaction()
  const [payment] = tx.splitCoins(tx.gas, [tx.pure.u64(priceMist)])
  tx.moveCall({
    target: `${cfg.packageId}::access_gate::purchase`,
    arguments: [tx.object(cfg.gateId), payment],
  })
  return tx
}

/**
 * Build a PTB that consumes one use of a single-use NFT, binding it to `nonce`. Selects
 * `consume` or `consume_soulbound` from `cfg.soulbound`. For unlimited passes there is
 * nothing to consume — do not call this.
 */
export function buildConsumeTx(
  cfg: AccessGateConfig,
  nftId: string,
  nonce: string,
): Transaction {
  const tx = new Transaction()
  const fn = cfg.soulbound ? 'consume_soulbound' : 'consume'
  const nonceBytes = Array.from(new TextEncoder().encode(nonce))
  tx.moveCall({
    target: `${cfg.packageId}::access_gate::${fn}`,
    arguments: [tx.object(nftId), tx.object(cfg.gateId), tx.pure.vector('u8', nonceBytes)],
  })
  return tx
}

/**
 * Build a PTB that creates a new gate. Mostly for tooling/operators; the frontend usually
 * only purchases/consumes an existing gate.
 */
export function buildCreateGateTx(
  packageId: string,
  opts: {
    priceMist: bigint | number
    paymentRecipient: string
    defaultUses: bigint | number
    soulbound: boolean
    autoBurnAtZero: boolean
  },
): Transaction {
  const tx = new Transaction()
  tx.moveCall({
    target: `${packageId}::access_gate::create_gate`,
    arguments: [
      tx.pure.u64(opts.priceMist),
      tx.pure.address(opts.paymentRecipient),
      tx.pure.u64(opts.defaultUses),
      tx.pure.bool(opts.soulbound),
      tx.pure.bool(opts.autoBurnAtZero),
    ],
  })
  return tx
}
