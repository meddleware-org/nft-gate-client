/**
 * `@meddleware/nft-gate-client` — client-side helpers for the `access_gate` primitive.
 *
 * Client-side only: ownership queries, purchase/consume PTB builders, challenge signing,
 * and access-proof assembly. Server-side verification lives in the Rust gateway.
 */

export type {
  AccessGateConfig,
  GateAdminContext,
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
} from './ownership.js'
export {
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
} from './ptb.js'
export { fetchChallenge } from './challenge.js'
export {
  personalMessageForNonce,
  encodeAccessProof,
  decodeAccessProof,
  buildAccessProof,
} from './proof.js'
export type { PersonalMessageSigner } from './proof.js'
