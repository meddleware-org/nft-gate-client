/**
 * `@meddleware/nft-gate-client` — client-side helpers for the `access_gate` primitive.
 *
 * Client-side only: ownership queries, purchase/consume PTB builders, challenge signing,
 * and access-proof assembly. Server-side verification lives in the Rust gateway.
 */

export type {
  AccessGateConfig,
  CoreObject,
  GateAdminContext,
  GatePolicy,
  CommissionTerms,
  PlatformConfigInfo,
  OwnedGate,
  Challenge,
  AccessProof,
  OwnedAccessNft,
  OwnedObjectsClient,
  SuiObjectClient,
} from './types.js'

export {
  fetchAccessNfts,
  ownsAccessNft,
  parseOwnedAccessNft,
  fetchAccessNftById,
  parseAdminCap,
  parseGate,
  fetchAdminCaps,
  fetchGate,
  fetchOwnedGates,
  parsePlatformConfig,
  fetchPlatformConfig,
} from './ownership.js'
export {
  DEFAULT_GATE_POLICY,
  isRestrictivePolicy,
  BPS_DENOMINATOR,
  MAX_COMMISSION_BPS,
  platformCommissionTerms,
  commissionForPrice,
  minimumPaidPriceMist,
  gateCommissionMist,
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
  buildMakeGateFreeTx,
  buildMakeGateImmutableTx,
} from './ptb.js'
export { fetchChallenge } from './challenge.js'
export {
  personalMessageForNonce,
  encodeAccessProof,
  decodeAccessProof,
  buildAccessProof,
} from './proof.js'
export type { PersonalMessageSigner } from './proof.js'
