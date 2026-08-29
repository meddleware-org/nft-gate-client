import { Transaction } from '@mysten/sui/transactions'
import type { AccessGateConfig, GateAdminContext } from './types.js'

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
    arguments: [tx.object(cfg.gateId), tx.object(cfg.platformConfigId), payment],
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
    nftName: string
    nftImageUrl: string
    nftDescription: string
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
      tx.pure.string(opts.nftName),
      tx.pure.string(opts.nftImageUrl),
      tx.pure.string(opts.nftDescription),
    ],
  })
  return tx
}

// ── Gate administration (AdminCap-gated) ─────────────────────────────────────────
// Builders for the operator management surface. Each calls an `assert_admin`-gated entry
// point with `[adminCap, gate, <value>]`; the operator signs + executes with their wallet.
// The on-chain call aborts (`E_WRONG_GATE` / `E_FROZEN`) if the cap/gate mismatch or the
// gate is frozen, so these never need to pre-check.

/** The element type accepted by a `moveCall`'s `arguments` array. */
type MoveCallArg = NonNullable<Parameters<Transaction['moveCall']>[0]['arguments']>[number]

/** Build a single-`moveCall` admin PTB: `<fn>(adminCap, gate, ...extraArgs)`. */
function buildGateAdminCall(
  ctx: GateAdminContext,
  fn: string,
  extraArgs: (tx: Transaction) => MoveCallArg[],
): Transaction {
  const tx = new Transaction()
  tx.moveCall({
    target: `${ctx.packageId}::access_gate::${fn}`,
    arguments: [tx.object(ctx.adminCapId), tx.object(ctx.gateId), ...extraArgs(tx)],
  })
  return tx
}

/** Set the gate price (in MIST) charged by future `purchase` calls (0 = free). */
export function buildSetPriceTx(ctx: GateAdminContext, priceMist: bigint | number): Transaction {
  return buildGateAdminCall(ctx, 'set_price', (tx) => [tx.pure.u64(priceMist)])
}

/** Redirect future purchase payments to a new recipient address. */
export function buildSetPaymentRecipientTx(ctx: GateAdminContext, recipient: string): Transaction {
  return buildGateAdminCall(ctx, 'set_payment_recipient', (tx) => [tx.pure.address(recipient)])
}

/** Pause or unpause `purchase` (paused ⇒ `purchase` aborts with `E_PAUSED`). */
export function buildSetPausedTx(ctx: GateAdminContext, paused: boolean): Transaction {
  return buildGateAdminCall(ctx, 'set_paused', (tx) => [tx.pure.bool(paused)])
}

/** Change the default uses for future mints (0 ⇒ unlimited pass; N ⇒ single-use with N). */
export function buildSetDefaultUsesTx(ctx: GateAdminContext, defaultUses: bigint | number): Transaction {
  return buildGateAdminCall(ctx, 'set_default_uses', (tx) => [tx.pure.u64(defaultUses)])
}

/** Switch the soulbound flag for future mints (does not affect already-minted NFTs). */
export function buildSetSoulboundTx(ctx: GateAdminContext, soulbound: boolean): Transaction {
  return buildGateAdminCall(ctx, 'set_soulbound', (tx) => [tx.pure.bool(soulbound)])
}

/** Toggle the auto-burn-at-zero policy for future mints. */
export function buildSetAutoBurnAtZeroTx(ctx: GateAdminContext, autoBurn: boolean): Transaction {
  return buildGateAdminCall(ctx, 'set_auto_burn_at_zero', (tx) => [tx.pure.bool(autoBurn)])
}

/** Update the default NFT display name for future mints. */
export function buildSetNftNameTx(ctx: GateAdminContext, name: string): Transaction {
  return buildGateAdminCall(ctx, 'set_nft_name', (tx) => [tx.pure.string(name)])
}

/** Update the default NFT image URL for future mints. */
export function buildSetNftImageUrlTx(ctx: GateAdminContext, url: string): Transaction {
  return buildGateAdminCall(ctx, 'set_nft_image_url', (tx) => [tx.pure.string(url)])
}

/** Update the default NFT description for future mints. */
export function buildSetNftDescriptionTx(ctx: GateAdminContext, description: string): Transaction {
  return buildGateAdminCall(ctx, 'set_nft_description', (tx) => [tx.pure.string(description)])
}

/** AdminCap-gated free grant (airdrop) of the gate's NFT flavour to `recipient`. */
export function buildAirdropTx(ctx: GateAdminContext, recipient: string): Transaction {
  return buildGateAdminCall(ctx, 'airdrop', (tx) => [tx.pure.address(recipient)])
}

/**
 * Make the gate immutable — **irreversible**. Consumes the `AdminCap` (passed by value) and sets
 * `Gate.frozen = true`, permanently ending all setters and `airdrop`. `purchase`/`consume` remain
 * permissionless. Grant everything first, then freeze.
 */
export function buildMakeGateImmutableTx(ctx: GateAdminContext): Transaction {
  const tx = new Transaction()
  tx.moveCall({
    target: `${ctx.packageId}::access_gate::make_gate_immutable`,
    // cap is consumed by value; gate is &mut.
    arguments: [tx.object(ctx.adminCapId), tx.object(ctx.gateId)],
  })
  return tx
}
