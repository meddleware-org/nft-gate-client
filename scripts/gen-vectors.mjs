// Generates vectors.json: the conformance vectors both nft-gate gateways test against. This
// package is the protocol's home, so the vectors live here and are published as
// `@meddleware/nft-gate-client/vectors.json`; the gateway repository vendors a copy that CI checks
// against the installed package.
//
//   node scripts/gen-vectors.mjs > vectors.json
//
// The message is assembled inline (not imported from src/) so tests can compare the library's
// output with an independent construction. Signatures are REAL Sui personal-message signatures.
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519'
import { Secp256k1Keypair } from '@mysten/sui/keypairs/secp256k1'
import { Secp256r1Keypair } from '@mysten/sui/keypairs/secp256r1'
import { blake2b } from '@noble/hashes/blake2.js'
import { secp256k1 } from '@noble/curves/secp256k1.js'
import { p256 } from '@noble/curves/nist.js'

const b64 = (bytes) => Buffer.from(bytes).toString('base64')
const fromB64 = (s) => new Uint8Array(Buffer.from(s, 'base64'))
const utf8Token = (obj) => Buffer.from(JSON.stringify(obj), 'utf8').toString('base64')

// ── the signed message ───────────────────────────────────────────────────────────────────────
const VERSION = 'nft-gate:access:v2'
const message = (c) =>
  new TextEncoder().encode(
    [VERSION, `origin:${c.origin}`, `gate:${c.gateId}`, `network:${c.network}`, `nonce:${c.nonce}`, ...(c.consumeDigest ? [`consume:${c.consumeDigest}`] : [])].join('\n'),
  )
const DIGEST = '5Wq9tE4gXz8hEvFhYt8KkTJb2Pp6qXqj8cRk3xN1mYdL'
const OWNERSHIP = {
  origin: 'https://gateway.example',
  gateId: '0x' + 'a1'.repeat(32),
  network: 'testnet',
  nonce: 'GOLDEN-NONCE-123',
}
const SINGLE_USE = { ...OWNERSHIP, consumeDigest: DIGEST }
const NONCE = OWNERSHIP.nonce

const messageCase = (name, context) => ({
  name,
  context,
  messageUtf8: new TextDecoder().decode(message(context)),
  messageBytesBase64: b64(message(context)),
})

const personalMessageRejects = [
  ['non-canonical origin: http on a non-loopback host', { ...OWNERSHIP, origin: 'http://gateway.example' }],
  ['non-canonical origin: upper-case host', { ...OWNERSHIP, origin: 'https://Gateway.example' }],
  ['non-canonical origin: trailing slash', { ...OWNERSHIP, origin: 'https://gateway.example/' }],
  ['non-canonical origin: default port', { ...OWNERSHIP, origin: 'https://gateway.example:443' }],
  ['non-canonical origin: credentials', { ...OWNERSHIP, origin: 'https://user@gateway.example' }],
  ['gate id: upper-case hex', { ...OWNERSHIP, gateId: '0x' + 'A1'.repeat(32) }],
  ['gate id: short', { ...OWNERSHIP, gateId: '0x1' }],
  ['network: unknown', { ...OWNERSHIP, network: 'testnet2' }],
  ['nonce: contains a newline (line injection)', { ...OWNERSHIP, nonce: 'n\nconsume:abc' }],
  ['nonce: contains a space', { ...OWNERSHIP, nonce: 'a b' }],
  ['nonce: empty', { ...OWNERSHIP, nonce: '' }],
  ['nonce: 129 characters', { ...OWNERSHIP, nonce: 'a'.repeat(129) }],
  ['consume digest: not base58', { ...OWNERSHIP, consumeDigest: 'DIGEST-1' }],
].map(([name, context]) => ({ name, context }))

// ── proof tokens ─────────────────────────────────────────────────────────────────────────────
const token = (o) => Buffer.from(JSON.stringify(o)).toString('base64')
// Raw-token helpers for the base64 / UTF-8 / JSON layer vectors below. A canonical `proof` JSON, extended
// with one unknown key where a vector needs a length that leaves base64 padding.
const PROOF_JSON = JSON.stringify({ address: '0x1', nonce: 'n', signature: 'AAAA' })
const withUnknownKey = (valueJson) => `${PROOF_JSON.slice(0, -1)},"k":${valueJson}}`
const rawToken = (bytes) => Buffer.from(bytes).toString('base64')
const stripPadding = (t) => (t.endsWith('=') ? t.replace(/=+$/, '') : fail('vector needs padded base64'))
const insertAt = (t, at, ch) => t.slice(0, at) + ch + t.slice(at)
const urlSafe = (t) => (/[+/]/.test(t) ? t.replace(/\+/g, '-').replace(/\//g, '_') : fail('vector needs + or / in the base64'))
function withTrailingBits(t) {
  // Set the lowest bit of the last data symbol: decodes to the same bytes in a lenient decoder, but the
  // symbol is not the canonical encoding of them.
  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  const body = t.replace(/=+$/, '')
  if (body.length === t.length) fail('vector needs padded base64')
  const last = ALPHABET.indexOf(body.at(-1))
  if (last & 1) fail('last symbol already has its low bit set')
  return body.slice(0, -1) + ALPHABET[last | 1] + t.slice(body.length)
}
function fail(why) {
  throw new Error(why)
}
const proofDecodeRejects = [
  ['oversized', 'A'.repeat(4097)],
  ['non-ASCII nonce', utf8Token({ address: '0x1', nonce: 'nönce', signature: 'AAAA' })],
  ['non-ASCII address', utf8Token({ address: '0xé1', nonce: 'n', signature: 'AAAA' })],
  ['empty address', token({ address: '', nonce: 'n', signature: 'AAAA' })],
  ['address without 0x', token({ address: '1234', nonce: 'n', signature: 'AAAA' })],
  ['address not hex', token({ address: '0xzz', nonce: 'n', signature: 'AAAA' })],
  ['address longer than 64 hex digits', token({ address: '0x' + '1'.repeat(65), nonce: 'n', signature: 'AAAA' })],
  ['empty nonce', token({ address: '0x1', nonce: '', signature: 'AAAA' })],
  ['nonce with a space', token({ address: '0x1', nonce: 'a b', signature: 'AAAA' })],
  ['empty signature', token({ address: '0x1', nonce: 'n', signature: '' })],
  ['signature not base64', token({ address: '0x1', nonce: 'n', signature: '***' })],
  ['consume digest not base58', token({ address: '0x1', nonce: 'n', signature: 'AAAA', consumeDigest: 'DIGEST-1' })],
  ['consume digest empty', token({ address: '0x1', nonce: 'n', signature: 'AAAA', consumeDigest: '' })],
  ['consume digest not a string', token({ address: '0x1', nonce: 'n', signature: 'AAAA', consumeDigest: 7 })],
  ['JSON array', token(['0x1'])],
  ['JSON null', token(null)],
  // The base64 / UTF-8 / JSON layers underneath the field grammar. The Rust gateway refuses each of these
  // (canonical padded standard base64, `trim()` at the ends only, strict UTF-8, serde_json's parser), so
  // every decoder must; each one carries an otherwise valid proof, so only that layer can be the reason.
  ['unpadded base64', stripPadding(rawToken(withUnknownKey('"a"')))],
  ['whitespace inside the token', insertAt(rawToken(PROOF_JSON), 8, '\n')],
  ['padding in the middle of the token', insertAt(rawToken(PROOF_JSON), 8, '=')],
  ['more padding than base64 allows', rawToken(withUnknownKey('"a"')) + '='],
  ['non-zero trailing bits in the last base64 symbol', withTrailingBits(rawToken(withUnknownKey('"a"')))],
  ['URL-safe base64 alphabet', urlSafe(rawToken(withUnknownKey('"~~~???>>>"')))],
  ['invalid UTF-8 inside an unknown key', rawToken(Buffer.concat([Buffer.from('{"address":"0x1","nonce":"n","signature":"AAAA","'), Buffer.from([0xff, 0xfe]), Buffer.from('":1}')]))],
  ['UTF-8 byte-order mark before the JSON', rawToken(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(PROOF_JSON)]))],
  ['unpaired surrogate escape in an unknown key', rawToken(`${PROOF_JSON.slice(0, -1)},"\\ud800":1}`)],
  ['number out of range in an unknown value', rawToken(withUnknownKey('1e999'))],
  ['JSON nested 128 levels deep', rawToken(withUnknownKey(`${'['.repeat(127)}${']'.repeat(127)}`))],
].map(([name, tok]) => ({ name, token: tok }))

// ── signatures ───────────────────────────────────────────────────────────────────────────────
const edKp = Ed25519Keypair.fromSecretKey(new Uint8Array(32).fill(7))
const k1Kp = Secp256k1Keypair.fromSecretKey(new Uint8Array(32).fill(9))
const r1Kp = Secp256r1Keypair.fromSecretKey(new Uint8Array(32).fill(11))

async function vec(scheme, kp, context) {
  const address = kp.toSuiAddress()
  const { signature } = await kp.signPersonalMessage(message(context))
  const proof = { address, nonce: context.nonce, signature, ...(context.consumeDigest ? { consumeDigest: context.consumeDigest } : {}) }
  return { scheme, address, context, signature, proofToken: token(proof), expect: true }
}

const edSig = (await edKp.signPersonalMessage(message(OWNERSHIP))).signature
const edSigSingle = (await edKp.signPersonalMessage(message(SINGLE_USE))).signature
const k1Sig = (await k1Kp.signPersonalMessage(message(OWNERSHIP))).signature
const r1Sig = (await r1Kp.signPersonalMessage(message(OWNERSHIP))).signature

// A valid signature presented against a message rebuilt from a different audience must fail.
const mismatch = (name, address, signature, context) => ({ case: name, address, signature, context, expect: false })
const audienceMismatch = [
  mismatch('wrong origin', edKp.toSuiAddress(), edSig, { ...OWNERSHIP, origin: 'https://other.example' }),
  mismatch('wrong gate', edKp.toSuiAddress(), edSig, { ...OWNERSHIP, gateId: '0x' + 'b2'.repeat(32) }),
  mismatch('wrong network', edKp.toSuiAddress(), edSig, { ...OWNERSHIP, network: 'mainnet' }),
  mismatch('wrong nonce', edKp.toSuiAddress(), edSig, { ...OWNERSHIP, nonce: 'GOLDEN-NONCE-124' }),
  mismatch('gateway is single-use but the signature has no consume line', edKp.toSuiAddress(), edSig, SINGLE_USE),
  mismatch('gateway is not single-use but the signature has a consume line', edKp.toSuiAddress(), edSigSingle, OWNERSHIP),
  mismatch('single-use: wrong consume digest', edKp.toSuiAddress(), edSigSingle, { ...SINGLE_USE, consumeDigest: '9' + DIGEST.slice(1) }),
  mismatch('v1 message (no audience) is refused', edKp.toSuiAddress(), (await edKp.signPersonalMessage(new TextEncoder().encode(`nft-gate:access:${NONCE}`))).signature, OWNERSHIP),
]

// ── negative + ZIP-215 vectors (over the ownership message) ──────────────────────────────────
const suiAddress = (flag, pk) => '0x' + Buffer.from(blake2b(Uint8Array.from([flag, ...pk]), { dkLen: 32 })).toString('hex')
const bigToBytes32 = (n) => Uint8Array.from(Buffer.from(n.toString(16).padStart(64, '0'), 'hex'))
const bytesToBig = (b) => BigInt('0x' + Buffer.from(b).toString('hex'))
function highS(sigB64, order) {
  const raw = fromB64(sigB64)
  raw.set(bigToBytes32(order - bytesToBig(raw.subarray(33, 65))), 33)
  return b64(raw)
}
function ed25519NonCanonicalS(sigB64) {
  const raw = fromB64(sigB64)
  const L = 2n ** 252n + 27742317777372353535851937790883648493n
  const s = bytesToBig(Uint8Array.from(raw.subarray(33, 65)).reverse()) + L
  raw.set(bigToBytes32(s).reverse(), 33)
  return b64(raw)
}
const withFlag = (sigB64, flag) => { const raw = fromB64(sigB64); raw[0] = flag; return b64(raw) }
async function wrongIntent(kp) {
  const m = message(OWNERSHIP)
  // Intent scope 0 (TransactionData) instead of 3 (PersonalMessage), over the same BCS-wrapped bytes.
  const digest = blake2b(Uint8Array.from([0, 0, 0, ...uleb(m.length), ...m]), { dkLen: 32 })
  const sig = await kp.sign(digest)
  return b64(Uint8Array.from([0x00, ...sig, ...kp.getPublicKey().toRawBytes()]))
}
function uleb(n) { const out = []; do { let b = n & 0x7f; n >>>= 7; if (n) b |= 0x80; out.push(b) } while (n); return out }

const negative = (name, address, signature) => ({ case: name, address, context: OWNERSHIP, signature, expect: false })
const negativeSignatures = [
  negative('secp256k1 high-S', k1Kp.toSuiAddress(), highS(k1Sig, secp256k1.Point.CURVE().n)),
  negative('secp256r1 high-S', r1Kp.toSuiAddress(), highS(r1Sig, p256.Point.CURVE().n)),
  negative('ed25519 non-canonical s (s + L)', edKp.toSuiAddress(), ed25519NonCanonicalS(edSig)),
  negative('ed25519 wrong intent (TransactionData)', edKp.toSuiAddress(), await wrongIntent(edKp)),
  negative('ed25519 truncated', edKp.toSuiAddress(), b64(fromB64(edSig).subarray(0, 96))),
  negative('flag 0x03 multisig (fails closed)', edKp.toSuiAddress(), withFlag(edSig, 0x03)),
  negative('flag 0x05 zkLogin (fails closed)', edKp.toSuiAddress(), withFlag(edSig, 0x05)),
  negative('flag 0x06 passkey (fails closed)', edKp.toSuiAddress(), withFlag(edSig, 0x06)),
]

const identity = new Uint8Array(32)
identity[0] = 1
const zip215 = {
  description:
    'ed25519 small-order public key (identity), R = identity, s = 0: valid under ZIP-215 (the rule Sui validators apply) for any message, invalid under strict RFC 8032.',
  address: suiAddress(0x00, identity),
  context: OWNERSHIP,
  signature: b64(Uint8Array.from([0x00, ...identity, ...new Uint8Array(32), ...identity])),
  expect: true,
}

const out = {
  description:
    'Conformance vectors shared by the nft-gate gateways and clients (protocol nft-gate:access:v2). `personalMessage.cases` are the exact signed bytes for a context; `personalMessageRejects` are contexts no implementation may sign or accept; `signatures` are real Sui personal-message signatures that must verify against the message rebuilt from `context`; `audienceMismatch` are valid signatures whose verifier-side context differs in one bound field and must be refused; `negativeSignatures` must be refused; `zip215` pins ed25519 to ZIP-215 (Sui\'s rule); `proofDecode*` pin the token grammar; `addressNormalization` pins canonical addresses. Regenerate with: node scripts/gen-vectors.mjs > vectors.json',
  version: VERSION,
  personalMessage: { cases: [messageCase('ownership gateway', OWNERSHIP), messageCase('single-use gateway', SINGLE_USE)] },
  personalMessageRejects,
  proofDecode: { token: token({ address: '0x1', nonce: 'n', signature: 'AAAA' }), expect: { address: '0x1', nonce: 'n', signature: 'AAAA' } },
  proofDecodeRejects: {
    description: 'Tokens every decoder must reject before verification: size, ASCII, the field grammar, and the base64 (canonical padded standard alphabet, no inner whitespace), UTF-8 (strict, no BOM) and JSON (nesting depth 127, no unpaired surrogate escape, no overflowing number) layers underneath it.',
    cases: proofDecodeRejects,
  },
  addressNormalization: {
    description:
      'Both gateways canonicalise the proof address before comparing to on-chain owners: strip 0x, lower-case, zero-pad to 64 hex, re-prefix 0x.',
    cases: [
      { input: '0x1', expected: '0x' + '0'.repeat(63) + '1' },
      { input: '0xABCDEF', expected: '0x' + '0'.repeat(58) + 'abcdef' },
      { input: '0x' + '0'.repeat(61) + '123', expected: '0x' + '0'.repeat(61) + '123' },
    ],
  },
  signatures: [
    await vec('ed25519', edKp, OWNERSHIP),
    await vec('secp256k1', k1Kp, OWNERSHIP),
    await vec('secp256r1', r1Kp, OWNERSHIP),
    await vec('ed25519 single-use', edKp, SINGLE_USE),
  ],
  audienceMismatch,
  negativeSignatures,
  zip215,
}
process.stdout.write(JSON.stringify(out, null, 2) + '\n')
