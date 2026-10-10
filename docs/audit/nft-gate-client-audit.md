# Security Audit — `nft-gate-client`

**Classification:** Internal security review
**Project:** nft-gate-client  (`@meddleware/nft-gate-client` — the client side of the nft-gate wire
  protocol: challenge fetching, the audience-bound personal message a wallet signs, access-proof
  encoding/decoding, the gateways' response contract, and the published conformance vectors; imported by
  the Workers gateway and by walrus-client)
**Project type:** TS SDK (npm package, ships TypeScript source + declaration-only build)
**Template:** AUDIT_TEMPLATE.md (2026-10-08) + AUDIT_TEMPLATE_TS.md (2026-10-08) +
  AUDIT_TEMPLATE_SUI_CLIENT.md (2026-10-08) + AUDIT_TEMPLATE_AUTH.md (2026-10-08)
  - AUTH is **triggered** since the 2026-10-09 re-verification. The 2026-10-03 pass treated it as a draft
    that homed the access proof in the Sui client lens. The lens is now complete, and its *Signed-challenge
    protocols* category and AUTH-M11 are the home of the audience-bound message this package defines. The
    package issues, verifies and stores no credential, and makes no authorisation decision, so the issuer,
    verifier, OAuth, BFF and IdP categories are N/A.
  - WALRUS, VUE, IMG, OPS, PROXY, WORKERS, SEAL and PLATFORM lenses: not triggered. The package is not
    shipped as an image, forwards nothing, and touches no storage, Seal policy or chain. The vector
    generator `scripts/gen-vectors.mjs` signs only with throw-away test keys and never touches a chain.

**Deployment status:**

- npm `@meddleware/nft-gate-client` **0.0.16**, published 2026-10-08T06:28Z (`dist-tags.latest`), with an
  SLSA v1 provenance attestation on the registry (`dist.attestations.provenance.predicateType` =
  `https://slsa.dev/provenance/v1`, `gitHead` = `e114369`). Git tag `v0.0.16` is at `e114369`.
- `main` is two commits ahead of the tag and unreleased: `ff6256d` (Dependabot config) and `ed876ba`
  (Dependabot dev-dependency lockfile bump, 2026-10-09). Neither changes `src/` or the published files.
- Consumers: `nft-gate/gateway-workers` (`^0.0.16`; imports the decoder and the message derivation; Worker
  redeployed from `main` 2026-10-09 against the 2026-10-09 `access_gate` publication and relay gate),
  `walrus-client` (`^0.0.16`; `fetchChallenge` + `buildAccessProof`) and `docs` (`^0.0.16`).
  `nft-gate/gateway-rust` mirrors the format and consumes a vendored copy of `vectors.json`; it is kept at
  parity and **not deployed** (decision).
- Live check 2026-10-09: the paywall e2e against the live dashboard passed with an
  `nft-gate:access:v2` proof built by this package (pass bought on gate `0x316f1bf9…`, consumed, upload
  through the Worker; the indexer shows minted=1 consumed=1).

**Review date:** 2026-10-03; re-verified 2026-10-09
**Reviewer:** Internal review
**Severity ceiling:** Medium — the package holds no funds or keys and makes no authorisation decision.
  However, `decodeAccessProof` and `personalMessage` sit **on the live Workers gateway's verification
  path**, and the message format it defines decides what a user's signature can be replayed for. A bypass
  still requires a gateway decision, so nothing here reaches High on its own.
**Status:** re-verified 2026-10-09 at `ed876ba` (release `0.0.16`, tag `e114369`). Of the 26 findings
  (F1–F26), 5 are Positive and 21 carry a disposition: 9 RESOLVED, 6 MITIGATED, 1 ADJUDICATED, 4
  ACCEPTED-RISK, 1 DEFERRED (a pre-mainnet gate). This supersedes the 2026-10-03 pass, which recorded
  findings only. The audit lives in the package (see *Location* below).

**Package manager / lockfile:** npm; `package-lock.json` committed (lockfileVersion 3, 176 packages, all
  dev)
**Module format:** ESM (`"type": "module"`)
**Publish model:** ships TS source (`exports["."].default` = `./src/index.ts`) + declaration-only build
  (`types` = `./dist/index.d.ts`, emitted by `prepublishOnly`) + `vectors.json`
  (`exports["./vectors.json"]`)
**Runtime targets:** browsers (`browserslist`: `> 0.5%, last 2 versions, not dead`), Node 24 LTS (the
  workspace decision; CI runs Node 24; no `engines` field, F20), workerd
**Peer dependencies:** none (no runtime dependencies at all)

**Sui SDK:** none at runtime (since 0.0.13). Dev-only: `@mysten/sui` ^2.35.0 (installed 2.35.0, within
  the ADR-0001 `^2.33.1` baseline) is the *independent verifier* in `tests/vectors.test.ts`, and
  `@noble/curves` / `@noble/hashes` ^2.4.0 build the negative signatures in `scripts/gen-vectors.mjs`.
  None is shipped (`files` whitelist).
**Transport:** none to the chain. It makes one HTTPS `GET <gateway>/v1/challenge`.
**Networks:** network-agnostic code. The signed message **binds** the network
  (`localnet|devnet|testnet|mainnet`), supplied by the caller and rebuilt by the gateway from its own
  configuration (F9).
**On-chain packages consumed:** none. `access_gate` builders and reads moved to
  `@meddleware/access-gate-client` in 0.0.13. The gate id is a caller-supplied message field, not a held
  constant.
**Auth role(s):** signed-challenge **client** — builds the access proof (a bearer token) from a
  caller-supplied wallet signature. It verifies nothing and decides nothing.
**Identity provider:** none.
**Token formats:** `base64(JSON{address, nonce, signature, consumeDigest?})` bearer proof, at most 4096
  characters; the signature is a Sui personal-message signature over the v2 message.
**Signing / client credentials:** none held. Signing is a caller-supplied `PersonalMessageSigner`.
**Authorization model:** none here. The gateways decide (signature + chain state), deny by default.

---

## Location

This audit was relocated on 2026-10-03 from the shared corpus, `docs/audit/nft-gate-client-audit.md`, to
`nft-gate-client/docs/audit/nft-gate-client-audit.md`. All `F#`/`OQ#` IDs from the 2026-09-18 pass are
kept, F1–F8 and OQ1–OQ4. The 2026-10-03 pass added F9–F23 and OQ5–OQ7. The 2026-10-09 re-verification
adds F24–F26. Repo-local audit is canonical (decision).

The old shared path keeps a pointer stub. The corpus `README.md` index and the `SYNTHESIS.md` links
(S1, S2) point here. Templates are cited by name and date because workspace-relative links do not
resolve inside the package.

---

## Executive summary

The package is small, about 360 lines of source across five files with no runtime dependencies. It does
four things:

- `fetchChallenge` fetches a nonce from a gateway.
- `personalMessage` derives the exact, audience-bound bytes the wallet signs.
- The proof functions encode and decode the `base64(JSON {address, nonce, signature,
  consumeDigest?})` token under one shared field grammar.
- `contract.ts` defines the gateways' response contract (statuses, conflict codes, error body).

It also publishes `vectors.json`, the conformance vectors both gateways test against. It never verifies a
signature, holds a key or touches the chain, and the invariants in its `CLAUDE.md` and `SECURITY.md`
hold. `SECURITY.md` now describes the real mechanism (F16).

**What changed since the 2026-10-03 pass.** Release 0.0.16 (`e114369`, 2026-10-08) closed the findings
that were open:

- **F9 (Medium)** — the signed message is now `nft-gate:access:v2`, multi-line ASCII, binding the gateway
  origin, gate id, network, nonce and (single-use gateways) the consume digest. Gateways rebuild it from
  their own configuration. A signature for one gateway, gate, network or consume cannot be replayed at
  another.
- **F10, F13, F14, F18** — one field grammar (address, nonce, signature, base58 digest) is applied
  identically on encode, decode and in the Rust gateway; empty and wrongly typed fields are rejected; the
  snake_case `expires_at` fallback is gone.
- **F11, F12** — redirects are refused and the challenge body is capped while streaming.
- **F15, F16** — the response contract is exported, and `vectors.json` is generated, asserted here with an
  independent verifier, published, and consumed by both gateways.

**Where residual risk remains** (all Low or Info):

1. **F24 (Low, ACCEPTED-RISK)** — the base64 layer is still lenient (unpadded, whitespace, invalid UTF-8
   in an unknown key), so the live Workers decoder admits a few tokens the undeployed Rust gateway
   refuses. The field grammar and every signature check are identical, so this is not a bypass.
2. **F11, F14, F15, F17, F18 (MITIGATED)** — small remainders: no `cache: 'no-store'`, a bad address or
   an expired challenge still reaches the wallet prompt, walrus-client keeps its own conflict helper with
   a message-regex fallback, a few documentation and manifest nits, and a digest check by shape only.
3. **Wallet display** — audience binding only helps if the user or wallet notices a wrong origin line
   (Risks). A phishing site can still ask a victim to sign a message that names the real gateway.

**Verified strengths.**

- Zero runtime dependencies and no hardcoded addresses or secrets.
- A pollution-safe field-by-field decode, and a hardened `fetchChallenge`: https only, `new URL`, timeout
  plus caller signal, no redirects, streamed 4 KiB cap, type and alphabet checks.
- UTF-8-safe encode with the ASCII contract enforced on both sides, and a token this package emits is one
  every gateway accepts.
- Published vectors with **real signatures** (ed25519, secp256k1, secp256r1, single-use), ZIP-215 and
  negative cases (wrong origin, gate, network, nonce, digest; v1 message; high-S; wrong intent; multisig,
  zkLogin and passkey flags fail closed), verified by the Sui SDK as an independent implementation.
- Strict TypeScript (`noUncheckedIndexedAccess`) and an accurate `sideEffects: false`.
- An explicit `files` whitelist: 15 packed files, no tests or env files.
- `npm audit` gates both CI and publish; OIDC publishing with a provenance attestation verified on the
  registry; Dependabot grouped weekly updates in place.

**Posture.** Low-risk library code. The one pre-mainnet gate left is the inline justification of three
narrowing casts (F25). External review is a maintainer item (`OPERATOR_TASKS.md`, "Funding, grants and an
external audit — after launch").

---

## Threat model / trust boundaries

**Primary trust anchor:** none inside this package, which decides nothing. Authorisation is the
gateways' job (signature + chain state). The package's security role is to make the client and every
gateway derive **identical bytes and identical parse results**, and to make the signed message
unambiguous and audience-bound.

| # | Actor / authority | Holds / controls | Can do | Bounded by |
| --- | --- | --- | --- | --- |
| A1 | End user + wallet | private key (in the wallet) | sign the v2 message | caller-supplied `PersonalMessageSigner`; the package never sees keys |
| A2 | Gateway (`/v1/challenge`) | the nonce the user will sign | choose the nonce | https-only host check; nonce alphabet `[A-Za-z0-9._~-]{1,128}` (no whitespace, so no extra message line); redirects refused; body capped at 4 KiB while streaming |
| A3 | On-path attacker / hostile network | traffic if TLS is downgraded | substitute the nonce | https only, and a redirect is an error (F11) |
| A4 | Phishing site / other dApp sharing the wallet | a sign prompt | have the user sign a message that names the **real** gateway | the message names origin, gate, network and consume digest, so it is useless at any other audience; the wallet display is the remaining control (F9, Risks) |
| A5 | Attacker submitting tokens to a gateway | the token string | exercise `decodeAccessProof` on the Workers gateway | 4096-char cap, ASCII contract, field grammar, field-by-field copy; lenient base64 layer (F24) |
| A6 | Consuming app (walrus-client, gateways) | how outputs are used | mis-handle gateway responses | `contract.ts` defines the contract; walrus-client has not adopted the helper (F15) |
| A7 | npm registry / dependency authors | tarball; dev toolchain | ship altered code | lockfile; `npm audit`; OIDC provenance; zero runtime deps |
| A8 | Maintainer / CI | publish | release a version | tag-gated, OIDC, idempotent (F21) |

### Identity & credential matrix (AUTH lens)

| Authority / credential | Holder | What it confers | Misuse / compromise impact | Rotation / revocation plan |
| --- | --- | --- | --- | --- |
| User's wallet private key | the wallet, never this package | signs the access message | n/a here | n/a (wallet) |
| Access proof (bearer token) | the client, in memory, then the gateway request header | one gated request, or one single-use redemption | replay within the nonce TTL (300 s) and only at the gateway, gate, network and consume it names | single-use nonce consumed atomically gateway-side; short TTL; the package never logs or stores the token (F23) |
| Challenge nonce | the gateway issues it; the client holds it for one signing | nothing alone | a relayed nonce is bound to the signer's chosen audience (F9) | expires; consumed at first use |

The IdP, token-issuance, OAuth, BFF and Keto categories are N/A: the package holds no OAuth client, no
signing key and no session.

### Supply chain & input matrix (TS lens)

| Actor / source | What it controls | How the project bounds it |
| --- | --- | --- |
| Dependency authors | dev-time only (no runtime deps) | lockfile; `npm audit --audit-level=high` in CI and publish; one install script (`fsevents`, optional, macOS) |
| Registry (npm) | the tarball | lockfile integrity hashes; provenance on publish |
| CI runner | build output, the publish token exchange | base §B.2 (below) |
| Maintainer | what is published | OIDC trusted publishing |
| Untrusted inputs: the gateway challenge response, proof tokens (gateway side), caller strings | shapes and sizes | `fetchChallenge` checks (F12 resolved); `requireProofShape` / `decodeAccessProof` checks (F10, residual F24) |
| Embedding host | globals (`fetch`, `AbortSignal.any`, `atob`/`btoa`, `TextEncoder`) | runtime floor: Node 24 LTS and evergreen browsers (F20) |

### On-chain dependency matrix (SUI_CLIENT lens)

| Object / package | ID | Sourced from | Used as | If stale/wrong | Fails |
| --- | --- | --- | --- | --- | --- |
| — | — | — | — | the package references no package, object, type or event since 0.0.13; the gate id is a caller-supplied message field that the gateway compares with its own | — |

General actors: **wallet** (A1; it signs whatever bytes it is given and displays them to the user,
which is why F9 and the Risks entry matter); **relay / gateway** (A2); **other dApps sharing the wallet**
(A4). The RPC fullnode and GraphQL service are N/A.

---

## Severity scale

Critical / High / Medium / Low / Info / Positive (unchanged across the corpus).

---

## Scope

**In scope (HEAD `ed876ba`; release `0.0.16` = tag `v0.0.16` at `e114369`; re-verified 2026-10-09):**

- `src/{index,types,challenge,proof,contract}.ts`
- `tests/{challenge,proof,contract,vectors}.test.ts`, `vectors.json`, `scripts/gen-vectors.mjs`
- `package.json`, `package-lock.json`, `tsconfig*.json`, `vitest.config.ts`, `eslint.config.ts`,
  `.gitignore`
- `README.md`, `SECURITY.md`, `CHANGELOG.md`, `CLAUDE.md`, `AGENTS.md`
- `.github/workflows/{node-ci,npm-publish}.yml`, `.github/dependabot.yml`

**Cross-repo evidence (read-only):**

- `nft-gate/conformance/vectors.json` (the vendored copy) and `nft-gate/scripts/sync-vectors.mjs`
- `nft-gate/gateway-rust/src/proof.rs` (decoder parity) and `src/verify.rs` (`conformance_shared_vectors`)
- `nft-gate/gateway-workers/src/wire.ts` and `src/verify.ts` (import this package)
- `walrus-client/src/flow.ts` (`isRedeemedConflict`)

**Out of scope:**

- The gateways' verification (their own audits: `nft-gate/gateway-{rust,workers}/docs/audit/`).
- `@meddleware/access-gate-client`, which owns everything F4 and F6 covered.
- The caller's wallet.

**Environment / commands (2026-10-09, Node 24.13.0):**

| Command | Result |
| --- | --- |
| `npm ci` | clean; 0 vulnerabilities |
| `npx vitest run` | **80 tests passed** (4 files: `challenge` 11, `contract` 3, `proof` 13, `vectors` 53) |
| `npx tsc --noEmit` / `npx eslint .` | clean / clean |
| `npm audit --audit-level=high` | 0 vulnerabilities |
| `npm run check:vectors` | clean (`vectors.json` equals the generator's output) |
| `npm run build` | emits `dist/{index,types,challenge,proof,contract}.d.ts`; `decodeAccessProof` now carries its doc comment (F17) |
| `npm pack --dry-run` | 15 files: `CHANGELOG.md`, `LICENSE`, `README.md`, `package.json`, `vectors.json`, `src/*.ts` (5), `dist/*.d.ts` (5); no tests, config or env files |
| `npm view @meddleware/nft-gate-client` | 0.0.16 (`latest`); `dist.attestations.provenance.predicateType` = `https://slsa.dev/provenance/v1` |
| Decoder probe (`decodeAccessProof` on crafted tokens) | accepted: canonical, unpadded, whitespace-split, extra unknown key, invalid UTF-8 inside an unknown key. Rejected: non-string `consumeDigest`. The `consume_digest` key is ignored. (F10, F24) |

The review left no tracked file changed. `dist/` and `node_modules/` are git-ignored, and the probe script
lived outside the repository.

---

## Findings

### F1 — Proof emits the raw caller address, not a canonical Sui address

**Severity:** Medium   **Disposition:** RESOLVED (canonicalisation owned gateway-side)
**Where:** `src/proof.ts:115-134` (`requireProofShape` checks the `0x` + 1–64 hex shape and copies the
address verbatim); `ADDRESS` at `:10`.

**Issue (2026-09-18):** The client passes the address through untouched. A gateway comparing it by
string equality with a canonical on-chain owner would mismatch and fail closed.

**Impact:** Interop/correctness only. It fails closed, so it is not a bypass.

**Remediation / evidence:** OQ1 decided gateway-side canonicalisation. Both gateways normalise before
every comparison (Workers `gateway-workers/src/verify.ts`, Rust `gateway-rust/src/verify.rs`
`normalize_address`). The `addressNormalization` vectors (0x1, 0xABCDEF, padded) are now published here in
`vectors.json` (3 cases) and asserted in both gateway suites. The decode doc comment and `SECURITY.md`
state the verbatim contract. Re-verified 2026-10-09: still holds.

### F2 — `btoa`/`atob` were not UTF-8 safe

**Severity:** Medium   **Disposition:** RESOLVED
**Where:** `src/proof.ts:101-111` (`toBase64` / `fromBase64`), `:23-28` (`isAscii`) and `:121` (the
ASCII check in `requireProofShape`).

**Issue (2026-09-18):** A non-ASCII nonce or address threw or corrupted the token.

**Impact:** Client/gateway divergence on non-ASCII input.

**Remediation / evidence:**

- Encoding goes through UTF-8 bytes. For ASCII the output is byte-identical to `btoa` (test "is
  btoa(JSON) with the documented key order", `tests/proof.test.ts:71`).
- Both encode and decode reject non-ASCII fields (test "applies the same rules when encoding as when
  decoding", `:75`, includes `nönce`). Since 0.0.16 the nonce alphabet is `[A-Za-z0-9._~-]` and the
  address and signature have their own grammars, so the ASCII contract is a corollary.
- Shared vectors: `proofDecodeRejects` "non-ASCII nonce" and "non-ASCII address", asserted in
  `tests/vectors.test.ts`.
- OQ2 decided: ASCII contract.

Re-verified 2026-10-09. The remaining base64-layer leniency is F24.

### F3 — `decodeAccessProof` did not bound input size

**Severity:** Low   **Disposition:** RESOLVED (size cap and empty-field rejection; OQ3 decided)
**Where:** `src/proof.ts:144` (`MAX_TOKEN_BYTES = 4096`) and `:155-157` (checked before `atob` /
`JSON.parse`).

**Issue (2026-09-18):** No length cap, and empty strings were accepted.

**Impact:** A memory/CPU spike when gateways decode attacker tokens.

**Remediation / evidence:**

- The cap is in place, with the test "rejects malformed tokens" (`'A'.repeat(4097)` → `/too large/`,
  `tests/proof.test.ts:88`) and the shared vector `proofDecodeRejects` "oversized".
- Empty and shape-invalid fields are now **rejected** (`requireProofShape`; release 0.0.16, `e114369`).
  The vectors "empty address", "address without 0x", "address not hex", "address longer than 64 hex
  digits", "empty nonce", "nonce with a space" and "empty signature" pin it. OQ3 is decided: reject.

### F4 — Ownership reads fully trust the RPC node

**Severity:** Low   **Disposition:** ADJUDICATED (by design) — **moved out of this package in 0.0.13**
**Where:** formerly `src/ownership.ts`. Now `@meddleware/access-gate-client` `ownership.ts`
(`ownsAccessNft`).

**Issue / Impact:** A lying RPC node can fabricate ownership. This is acceptable as a frontend hint;
the gateway re-reads a trusted node.

**Remediation / evidence:** Adjudicated 2026-09-18. Re-verified 2026-10-09: the code does not exist
here (`CHANGELOG.md` 0.0.13). The ownership-counts-usable-passes decision and the function's
`uses_remaining` handling are tracked in the access-gate-client audit.

### F5 — Lockfile drift on `@mysten/sui`

**Severity:** Low   **Disposition:** RESOLVED (superseded)
**Where:** formerly `package.json`.

**Issue / Impact:** The requested range and the locked version had drifted.

**Remediation / evidence:** Resolved 2026-09-18 by a range update. It is superseded by 0.0.13, which
dropped `@mysten/sui` as a runtime dependency, so there are none (`package.json` has no `dependencies`
key; `npm ls --omit=dev` is empty). Since 0.0.16 `@mysten/sui` returns as a **dev** dependency only
(`^2.35.0`, installed 2.35.0) for the independent verifier in the vector tests. OQ4 is decided as a
result.

### F6 — PTB builders verified correct

**Severity:** Positive (historical)
**Where:** formerly `src/ptb.ts`.

The purchase/consume builders were correct on 2026-09-18. They moved to `@meddleware/access-gate-client`
in 0.0.13, and their ABI coupling is that package's audit (SC lens B.SC-2).

### F7 — Publish process: advisory scan and `SECURITY.md`

**Severity:** Low   **Disposition:** RESOLVED
**Where:** `.github/workflows/node-ci.yml` and `npm-publish.yml` (`npm audit --audit-level=high`);
`SECURITY.md`.

**Issue (2026-09-18):** CI had no advisory scan and `SECURITY.md` was missing.

**Impact:** Advisories could ship unnoticed, and reporters had no channel.

**Remediation / evidence:** Both are present. Re-verified 2026-10-09: `npm audit` reports 0
vulnerabilities, and the gate runs in CI and in the publish `verify` job. `source-map-js` 1.2.2
(`5a0ed20`, GHSA-68fv-2mgg-jv7q) and the grouped Dependabot config (`ff6256d`, `ed876ba`) keep the
lockfile current. `SECURITY.md` drift (F16) is fixed.

### F8 — `JSON.parse` prototype pollution assessed

**Severity:** Positive
**Where:** `src/proof.ts:115-134` and `:155-162`.

The parsed object is never spread or merged. `requireProofShape` reads `address`, `nonce`, `signature`
and (when a valid string) `consumeDigest` into a fresh literal, so a `__proto__` key cannot reach a
prototype. Re-verified 2026-10-09; an unknown key such as `extra` is ignored, not copied.

### F9 — The signed message binds no audience (gateway, gate, network or consume digest)

**Severity:** Medium   **Disposition:** RESOLVED (0.0.16, `e114369`, 2026-10-08; residual wallet-display
risk recorded under Risks; client half of `nft-gate` `gateway-rust` F1 and `gateway-workers` F1)
**Where:**

- `src/proof.ts:4` (`ACCESS_MESSAGE_VERSION = 'nft-gate:access:v2'`), `:57-66` (`requireContext`),
  `:91-96` (`personalMessage`)
- `src/proof.ts:177-205` (`buildAccessProof` signs only that message)
- `README.md` "Wire protocol"; `vectors.json` `personalMessage`, `personalMessageRejects`,
  `audienceMismatch`

**Issue:** The 0.0.15 message was `nft-gate:access:<nonce>`, which contained only the nonce. Nonces are
issued to anyone, and the wallet showed the user an opaque string that named no service, so a signature
for one gateway's nonce could not be told apart from a signature for any other purpose that used the same
prefix.

**Impact:** A malicious site could obtain a nonce from a real gateway and have a visitor sign it.

- **Ownership mode:** the attacker gets one gated request as the victim.
- **Single-use mode (the live relay):** the attacker pairs the proof with one of the victim's public,
  not-yet-committed consume digests. This spends the victim's paid use.

It is bounded to one request per phished signature, within the nonce TTL (300 s).

**Remediation / evidence:** OQ5 decided (a)+(b)+(c) plus the multi-line form. Release 0.0.16 (breaking,
no v1 compatibility) introduced the message:

```text
nft-gate:access:v2
origin:<canonical origin>
gate:<0x + 64 lower-case hex>
network:<localnet|devnet|testnet|mainnet>
nonce:<nonce>
consume:<base58 digest>      (single-use gateways only)
```

- API: `personalMessage({ origin, gateId, network, nonce, consumeDigest? })`; `buildAccessProof` takes
  `gateway`, `gateId` and `network` and derives the origin with `gatewayOrigin(opts.gateway)` (the same
  URL string given to `fetchChallenge`; https only, loopback http, no credentials, host lower-cased,
  default port dropped). The origin is never read from the challenge response.
- Every field must be canonical or `personalMessage` throws, which also blocks line injection (nonce
  alphabet has no whitespace).
- Gateways rebuild the message from their own origin, gate and network, never from the token
  (`gateway-workers/src/verify.ts`; `gateway-rust/src/proof.rs` `personal_message`).
- Tests: `tests/proof.test.ts` "personalMessage" (3 tests, `:23-50`), "gatewayOrigin" (`:52`),
  "buildAccessProof" (3 tests, `:97-127`). Vectors (`tests/vectors.test.ts`, with the Sui SDK as the
  independent verifier): `personalMessage` 2 cases, `personalMessageRejects` 13, `audienceMismatch` 8
  (wrong origin, gate, network, nonce; single-use signature without a consume line and the reverse; wrong
  consume digest; a v1 message is refused).
- Both gateways consume the same vectors (Workers via the package at `^0.0.16`; Rust via the vendored
  `conformance/vectors.json`, test `conformance_shared_vectors`). Live: the 2026-10-09 paywall e2e used a
  v2 proof end to end.

**Residual:** audience binding stops cross-gateway, cross-gate, cross-network and cross-consume replay and
a swapped digest. It cannot stop a phishing site that has the victim sign a message that names the real
gateway; only the wallet display and the user noticing do (Risks, *Wallet display*).

### F10 — `decodeAccessProof` accepts tokens the Rust gateway rejects, and vice versa

**Severity:** Low   **Disposition:** MITIGATED (field grammar and digest typing resolved in 0.0.16; the
base64 and UTF-8 layer remains, tracked as F24)
**Where:** `src/proof.ts:115-134` (`requireProofShape`) and `:155-162` (`decodeAccessProof`) versus
`nft-gate/gateway-rust/src/proof.rs:144-205`.

**Issue:** The two gateways got different parse results for the cases below.

| Input | 0.0.15 (this package) | Rust | Now |
| --- | --- | --- | --- |
| `"consumeDigest": 123` (non-string) | silently dropped | `BadProof` | **fixed**: rejected by both |
| `"consume_digest"` snake_case key | ignored | honoured | **fixed**: ignored by both (Rust reads only `consumeDigest`) |
| empty or shape-invalid address / nonce / signature | accepted | accepted | **fixed**: rejected by both |
| non-base58 / non-ASCII `consumeDigest` | accepted | accepted | **fixed**: rejected by both |
| Unpadded base64, whitespace inside the token, non-canonical trailing bits | accepted (`atob`) | rejected | **open**, F24 |
| Invalid UTF-8 in the JSON | replaced with U+FFFD | rejected | **open**, F24 (a bad byte inside a checked field fails the grammar; inside an unknown key it passes here) |

**Impact:** It was the "identical decisions" drift the vectors exist to stop. Fixed for everything that
reaches a decision, because the field grammar is now one definition: `ADDRESS`, `NONCE`, `SIGNATURE`,
`TX_DIGEST` (`src/proof.ts:8-14`), mirrored in Rust. The residual is not a bypass, because the signature
and fields are still verified.

**Remediation / evidence:** Release 0.0.16 (`e114369`): `requireProofShape` is applied identically by
`encodeAccessProof` and `decodeAccessProof`; `consumeDigest` must be absent or a base58 digest string.
Sixteen `proofDecodeRejects` vectors (oversized, non-ASCII nonce/address, empty address/nonce/signature,
address without `0x` / not hex / over 64 digits, nonce with a space, signature not base64, digest not
base58 / empty / not a string, JSON array, JSON null) are asserted by `tests/vectors.test.ts` and by both
gateways. The base64-layer rows were not made strict; see F24 for the decision.

### F11 — `fetchChallenge` follows redirects and may serve a cached nonce

**Severity:** Low   **Disposition:** MITIGATED (redirects refused in 0.0.16; cache mode not set, see
residual)
**Where:** `src/challenge.ts:65` (`fetch(url, { signal, redirect: 'error' })`).

**Issue:**

- The https check applied to the configured host only, and a 3xx was followed. In Node (undici) and
  workerd an `https:` → `http:` redirect is followed, so the nonce could arrive over plaintext.
- With no `cache: 'no-store'`, a browser or intermediary may answer from cache.

**Impact:**

- The nonce decides what the user signs; substituting it is the F9 relay without phishing UI. With F9
  fixed the relayed nonce is bound to whatever audience the user signs, so the impact is lower.
- A cached nonce produces a confusing `NonceInvalid`.

**Remediation / evidence:**

- `redirect: 'error'` is set (CHANGELOG 0.0.16). `tests/challenge.test.ts:101` ("refuses redirects and
  caps a streamed body…") asserts the fetch init carries `redirect: 'error'`. It asserts the option, not
  a real 302 response.
- **Residual:** `cache: 'no-store'` and `credentials: 'omit'` are not set. Neither gateway sends a
  `Cache-Control` or validator on `/v1/challenge` (checked in `gateway-workers/src/index.ts:251-259` and
  `gateway-rust/src/main.rs`), so default HTTP caches have no freshness information to reuse, and a stale
  nonce fails closed with `NonceInvalid`. A plain `GET` sends no credentials cross-origin. Optional
  hardening, not a security gap.

### F12 — The challenge size cap is applied after reading the whole body

**Severity:** Low   **Disposition:** RESOLVED (0.0.16, `e114369`)
**Where:** `src/challenge.ts:17-44` (`readCapped`).

**Issue:** `res.text()` buffered the entire response before the 4096 check, and `text.length` counts
UTF-16 code units, not bytes.

**Impact:** A hostile or compromised gateway host could stream an arbitrarily large body into a browser
tab or a Node process within the 10 s timeout. Low impact because the host is operator-configured.

**Remediation / evidence:** `readCapped` rejects early when `Content-Length` exceeds 4096, otherwise reads
`res.body` with a byte counter and cancels the stream past 4096 bytes. Tests: `tests/challenge.test.ts:80`
(5000-byte body → `/too large/`) and `:101` (an endless stream with no `Content-Length` →
`/too large/`). The decode is not `fatal: true`, but the nonce is then checked against the ASCII alphabet,
so a replacement character fails closed.

### F13 — A missing expiry is accepted as `0`, contradicting the documented contract; snake_case fallback is dead

**Severity:** Low   **Disposition:** RESOLVED (0.0.16, `e114369`)
**Where:** `src/challenge.ts:78-84` (was `body.expiresAt ?? body.expires_at ?? 0`).

**Issue:** A response with no expiry returned `{ nonce, expiresAt: 0 }` instead of throwing as
documented, and a snake_case `expires_at` compatibility path nobody emitted widened the parse surface.

**Impact:** Callers that check `expiresAt` treated every such challenge as expired; the documentation
misled integrators.

**Remediation / evidence:** `expiresAt` must be a finite number greater than 0, camelCase only. Tests:
`tests/challenge.test.ts:22` ("does not accept snake_case expires_at") and the `:80` loop over `0`, `-1`,
`null`, `'1'`. JSDoc matches (`challenge.ts:46-57`). A `challengeResponse` vector was not added; the shape
is pinned by these tests and by each gateway's own tests (both emit `{ nonce, expiresAt }`).

### F14 — The encode side does not enforce what the decode side requires

**Severity:** Low   **Disposition:** MITIGATED (encode rules resolved in 0.0.16; the wallet can still be
prompted for a bad address or an expired challenge)
**Where:** `src/proof.ts:139-141` (`encodeAccessProof`) and `:177-205` (`buildAccessProof`).

**Issue:** `buildAccessProof` asked the wallet to sign without validating its inputs, and
`encodeAccessProof` accepted any strings.

**Impact:** The user saw a wallet prompt that could not succeed, and errors surfaced as a generic gateway
403.

**Remediation / evidence:**

- `encodeAccessProof` now applies `requireProofShape`, so a token this package emits is one every
  gateway's grammar accepts (test `tests/proof.test.ts:75`).
- `buildAccessProof` builds the message first, so a bad gateway URL, gate id, network, nonce or consume
  digest throws **before** the signer is called (test `:120`, signer not called).
- **Residual:** the `address` and the returned `signature` are checked only after signing (in
  `encodeAccessProof`), and an expired `challenge.expiresAt` is not checked client-side, so those cases
  still reach the wallet prompt and then throw a precise client error instead of a gateway 403. UX only;
  the gateway enforces expiry.

### F15 — The protocol's response contract is not defined in the protocol package

**Severity:** Low   **Disposition:** MITIGATED (contract defined, exported and tested; consumer adoption
and `responses` vectors remain)
**Where:**

- `src/contract.ts` (new in 0.0.16): `GATEWAY_STATUS` (`:8`), `GATEWAY_CONFLICT_CODES` (`:27`),
  `GatewayErrorBody`, `parseGatewayError` (`:40`)
- `walrus-client/src/flow.ts:97-103` `isRedeemedConflict`
- `nft-gate/gateway-workers/src/redemption.ts` and `gateway-rust/src/main.rs:252-260` (both emit
  `code: 'redeemed'` / `'leased'`)

**Issue:** The wire protocol had a response side that clients act on, with money at stake (re-consume or
not), but it was undefined here, and the Rust gateway had drifted (no `code`).

**Impact:** Lost uses for users behind a non-conforming gateway, and no single place to test the
contract.

**Remediation / evidence:**

- The contract is exported (`GATEWAY_STATUS`, `GATEWAY_CONFLICT_CODES`, `GatewayConflictCode`,
  `GatewayErrorBody`, `parseGatewayError`, which drops unknown codes). Tests: `tests/contract.test.ts`
  (3 tests, including that a state-store outage `503` stays distinct from a conflict `409`).
- The Rust gateway now emits the `code` (`main.rs:252-260`), so both gateways match the contract. OQ7
  decided: part of the public API.
- **Residual:** `isRedeemedConflict(err)` and `accessProofHeaders(token)` were not added; there are no
  `responses` vectors in `vectors.json`; and walrus-client still carries its own `isRedeemedConflict`
  with the `409` + `redeemed` message-regex fallback (`flow.ts:100`). Adopting the package helper is
  walrus-client work, tracked in its audit.

### F16 — The package does not assert the shared conformance vectors; docs overstate the coupling

**Severity:** Low   **Disposition:** RESOLVED (0.0.16, `e114369`; OQ6 decided: publish from this package)
**Where:** previously `tests/proof.test.ts:19-45` (a local golden vector with stale paths),
`SECURITY.md` invariant 3, `README.md`.

**Issue:** The shared `vectors.json` was asserted by both gateways but not by this package, the local
vector differed from it, and `SECURITY.md` overstated the control.

**Impact:** A published version could break the gateways before any test noticed.

**Remediation / evidence:**

- `vectors.json` is generated by `scripts/gen-vectors.mjs` (message built independently of `src/`, real
  ed25519 / secp256k1 / secp256r1 signatures, ZIP-215 and negative cases) and published as
  `@meddleware/nft-gate-client/vectors.json` (`exports`, `files`).
- `tests/vectors.test.ts` (53 test cases) asserts every vector with the library **and** with the Sui SDK
  verifier as an independent implementation.
- `npm run check:vectors` runs in Node CI and in the publish `verify` job, so a stale file cannot ship.
- The gateways consume it: Workers through the package, Rust through the vendored
  `nft-gate/conformance/vectors.json` (synced by `nft-gate/scripts/sync-vectors.mjs`, asserted by
  `gateway-rust/src/verify.rs` `conformance_shared_vectors`).
- `SECURITY.md` invariant 3 and `README.md` now describe this mechanism. The local golden vector and its
  stale paths are gone.

### F17 — Documentation accuracy: orphaned JSDoc, stale comments, undeclared runtime floor

**Severity:** Info   **Disposition:** MITIGATED (JSDoc and wording fixed in 0.0.16; small nits remain)
**Where:**

- `src/proof.ts:143-155`. The `decodeAccessProof` doc block now sits on the function and
  `MAX_TOKEN_BYTES` has its own comment; the emitted `dist/proof.d.ts` carries the documentation.
  **Fixed.**
- `src/types.ts` `Challenge.nonce` now states the real alphabet (1–128 characters of `A-Za-z0-9._~-`).
  **Fixed.**
- `tests/proof.test.ts` stale paths: gone with the local vector (F16). **Fixed.**
- `README.md` "Wire protocol" lists the `Challenge` bullet twice (one without the nonce alphabet).
  **Open**, doc nit.
- `AGENTS.md` "Node.js ≥ 22" while the workspace decision is Node 24 LTS only, and `package.json` has no
  `engines`. **Open**, tracked with F20.
- Outside this repo: `walrus-relay/package.json` describes itself as "Built on …
  @meddleware/nft-gate-client" but depends only on `@meddleware/walrus-client` (it reaches this package
  transitively). **Open**, wording in that repo.

**Issue / Impact:** These can mislead integrators and the planned TypeDoc reference (`dev.` site). This is
the TS lens §A *Accurate comments* class.

**Remediation / evidence:** The three open items are one-line edits in this and one other repo. Nothing
changes behaviour.

### F18 — `isTransactionDigest` checks shape only, not the decoded length

**Severity:** Info   **Disposition:** MITIGATED (now enforced at decode and message time; decoded length
not checked)
**Where:** `src/proof.ts:14` and `:18-20` (`/^[1-9A-HJ-NP-Za-km-z]{32,44}$/`).

**Issue:** Any 32–44-character base58 string passes, including strings that decode to fewer or more than
32 bytes. In 0.0.15 the check ran only before signing, so the Workers gateway sent any digest string to
the RPC.

**Impact:** Now limited. `requireProofShape` (`:130`) and `requireContext` (`:63`) apply the digest shape
on every path, in Rust as well (`is_tx_digest`), and the vectors "consume digest not base58 / empty / not
a string" pin it. A well-shaped digest of the wrong length still reaches the RPC, which refuses it.

**Remediation / evidence:** A dependency-free base58 decode requiring exactly 32 bytes would close it
(with vectors for leading `1`s and 43/44/45 characters). Low value, so left as a suggestion; the
gateway's chain lookup is the authority.

### F19 — CI gaps: no build in Node CI, `--if-present` everywhere, no lint before publish

**Severity:** Info   **Disposition:** ACCEPTED-RISK
**Where:**

- `.github/workflows/node-ci.yml` (`lint:js --if-present`; no `npm run build`).
- `npm-publish.yml` `verify` job (`type-check --if-present`, `test --if-present`, `build --if-present`;
  no lint step).

**Issue / Impact:**

- A declaration-emit failure would surface only on a tag.
- `--if-present` would silently pass if a script were renamed or removed.
- A tag on a commit that never passed Node CI would publish unlinted code.

**Remediation / evidence:** Accepted, with these controls in place. The publish `verify` job runs
`npm audit`, type-check, `check:vectors`, tests **and** `npm run build`, so a declaration failure blocks
the publish before the npm job; `prepublishOnly` builds again. Node CI (lint, type-check, vectors, tests,
audit) runs on every push to `main`, and tags are cut from `main`. The scripts are exercised by every
release, so a rename would fail the release tests. Dropping `--if-present`, adding `npm pack --dry-run`
and a lint step to `verify` stays on the suggestions list (S6).

### F20 — Runtime floor for `AbortSignal.any` / `AbortSignal.timeout` is undeclared

**Severity:** Info   **Disposition:** ACCEPTED-RISK
**Where:** `src/challenge.ts:63-64`; `package.json` `browserslist` and no `engines`.

**Issue:** `AbortSignal.any` needs Chrome 116 / Firefox 124 / Safari 17.4 / Node 20.3, and
`AbortSignal.timeout` needs Safari 16. On an older browser, passing `opts.signal` throws `TypeError:
AbortSignal.any is not a function` before any request is made.

**Impact:** The challenge fetch breaks on older browsers, but only when the caller passes a signal.

**Remediation / evidence:** Accepted. The workspace decision is Node 24 LTS only, CI runs Node 24, and the
browser floor is the evergreen set the `> 0.5%, last 2 versions` query selects in 2026, all of which
support both APIs. The failure is loud (a `TypeError` before any request), not silent. Declaring
`"engines": { "node": ">=24" }` and aligning `AGENTS.md` (F17) remains a one-line manifest suggestion.

### F21 — Positive: release chain and packaging

**Severity:** Positive

- Actions SHA-pinned (`actions/checkout@3d3c42e5…` v7.0.1, `actions/setup-node@82076278…` v7.0.0), Node
  24 in both workflows.
- `permissions: contents: read` at the top, `id-token: write` only on `publish-npm`.
- `npm ci`, and `npm audit --audit-level=high` in CI **and** publish; `check:vectors` in both.
- Tag-gated (`v*`), with a tag == `package.json` version check.
- Idempotent publish (registry probe plus a "cannot publish over" tolerance).
- The npm client is pinned (`npm@11.20.0`).
- OIDC `--provenance`, with the attestation verified on the registry for 0.0.16.
- `files` whitelist, and pack contents verified (15 files).
- `sideEffects: false` is accurate: no module has import-time effects.
- No `overrides`, no `allowScripts`. The only lifecycle script is `prepublishOnly` (declaration build).
- Grouped weekly Dependabot (`npm-minor-patch`, `github-actions`), triaged 2026-10-09; TypeScript 7,
  `@types/node` 26 and other major bumps are deliberately deferred (decision).

### F22 — Positive: `fetchChallenge` hardening (0.0.14, completed in 0.0.16)

**Severity:** Positive

- The URL is built with `new URL`; `https:` only, with `http:` for loopback; credentials in the URL are
  refused.
- Query and fragment are dropped; a path prefix is kept.
- A 10 s default timeout is combined with the caller's signal.
- Redirects are refused; the body is capped at 4 KiB while streaming (F11, F12).
- Non-2xx responses throw (and the body is cancelled).
- JSON parsing is guarded.
- The `nonce` must match the challenge alphabet and `expiresAt` must be a positive finite number (F13).
- Tests cover each case (`tests/challenge.test.ts`, 11 tests).

### F23 — Positive: minimal trusted surface

**Severity:** Positive

- No runtime dependencies.
- No package, object or gate IDs.
- No secrets and no key handling: signing is a caller-supplied `PersonalMessageSigner`.
- No `eval` or dynamic `import()`.
- No `console` output, so tokens and signatures never reach logs.
- Errors carry no token or signature material. The oversized-token message includes only the length.
- `strict` and `noUncheckedIndexedAccess` are on, and there are no `any` or `!` in `src/`.
  - Three `as` casts remain, each directly after a guard: `challenge.ts:77`, `proof.ts:161`,
    `contract.ts:45`. They carry no inline justification comment, which the TS lens asks for (F25).

### F24 — Base64 layer still lenient: unpadded, whitespace and invalid UTF-8 in unknown keys

**Severity:** Low   **Disposition:** ACCEPTED-RISK (residual of F10; revisit before the Rust gateway is
deployed or at the pre-mainnet review)
**Where:** `src/proof.ts:108-112` (`fromBase64`: `atob` + non-fatal `TextDecoder`) and `:155-162`, versus
`nft-gate/gateway-rust/src/proof.rs:157-160` (`BASE64_STANDARD.decode(token.trim())`, then
`serde_json::from_slice`).

**Issue:** Probe on 2026-10-09: `decodeAccessProof` accepts an unpadded token, a token with whitespace
inside it, and a token whose JSON has invalid UTF-8 inside an **unknown** key. The Rust decoder refuses all
three (canonical padding required, outer `trim()` only, strict UTF-8). Non-canonical trailing bits behave
the same way. No `proofDecodeRejects` vector covers these rows.

**Impact:** The same token can be admitted by the Workers gateway and refused by Rust, so the "identical
decisions" contract does not hold for these inputs. It is not a bypass: both gateways apply the same field
grammar and verify the signature, and a bad byte inside a *checked* field fails the grammar on both. Only
the Workers gateway is deployed; the Rust gateway is kept at parity but undeployed (decision), and Workers
is the stricter side for everything that decides access.

**Remediation / evidence:** Accepted as a Low residual. The fix, if wanted, is one decision applied in
both gateways: strict base64 (`^[A-Za-z0-9+/]*={0,2}$`, `length % 4 == 0`, re-encode equality), a fatal
`TextDecoder`, and `proofDecodeRejects` vectors for each row. This is the unclosed part of F10.

### F25 — Narrowing casts at trust boundaries carry no inline justification

**Severity:** Info   **Disposition:** DEFERRED (pre-mainnet gate in Section D: "no `as` at trust
boundaries without an inline justification"; maintainer code edit)
**Where:** `src/challenge.ts:77` (`as Record<string, unknown>`), `src/proof.ts:161`
(`as Record<string, unknown>`), `src/contract.ts:45` (`as GatewayConflictCode`).

**Issue:** The TS lens §A *Assertions at trust boundaries* asks every `as` on a path that handles
untrusted data to carry a justification. Each cast here immediately follows the guard that makes it sound
(an object check, or `includes` against the known code list), but no comment says so.

**Impact:** Reviewer clarity only; the code is correct.

**Remediation / evidence:** Add a one-line comment beside each cast (or replace the first two with a small
type guard) — suggestion S4. Carried over from the 2026-10-03 pass, where it was a suggestion and a
pre-mainnet checkbox; 0.0.16 added one more cast (`contract.ts:45`).

### F26 — `gatewayOrigin` error messages echo the gateway string, including any userinfo

**Severity:** Info   **Disposition:** ACCEPTED-RISK
**Where:** `src/proof.ts:42-55` (`invalid gateway URL: ${gateway}`, `gateway URL must use https:
${gateway}`).

**Issue:** The two messages include the caller's gateway string. For `http://user:pw@host` the https
check fires first, so the userinfo would appear in the error text. (The credentials check itself does not
echo.) TS lens §A *Secrets in output*.

**Impact:** Negligible. The gateway URL is operator configuration, not a secret, and userinfo in a gateway
URL is already rejected. A secret would reach a log only if an operator put one in a URL that is then
refused.

**Remediation / evidence:** Accepted. If tightened, report the host only or the fixed text without the
URL. No test pins the message text beyond `/https/` and `/invalid gateway URL/`
(`tests/proof.test.ts:52-59`).

---

## Section A — Invariant verification matrix

| # | Invariant | Enforced / asserted at | Proven by | Status |
| --- | --- | --- | --- | --- |
| I1 | Signed message is exactly the v2 multi-line ASCII message (origin, gate, network, nonce, optional consume) | `proof.ts:4, 57-66, 91-96` | `tests/proof.test.ts:23-50`; vectors `personalMessage` (2) and `personalMessageRejects` (13), asserted in `tests/vectors.test.ts` | HOLDS |
| I2 | Token = `base64(JSON{address,nonce,signature,consumeDigest?})`, fixed field order | `proof.ts:101-105, 139-141, 195-205` | "is btoa(JSON) with the documented key order" (`:71`); vector `proofDecode`, signature-vector `proofToken` round trips | HOLDS |
| I3 | Every decoder (this one and Rust) makes identical parse decisions | `proof.ts:115-134, 155-162` vs `gateway-rust/src/proof.rs:144-205` | 16 `proofDecodeRejects` vectors consumed by both | HOLDS for the field grammar; GAP at the base64 layer — F24 (accepted) |
| I4 | The client never verifies or decides | `decodeAccessProof` structural only | review | HOLDS |
| I5 | The client never holds keys | `PersonalMessageSigner` injection (`proof.ts:165-205`) | review | HOLDS |
| I6 | No hardcoded addresses, secrets or runtime dependencies | `package.json` (no `dependencies`); `src/` | review; `npm pack` contents; `npm ls --omit=dev` empty | HOLDS |
| I7 | Proof address is canonicalised before any comparison | gateways (`normalizeAddress`/`normalize_address`) | `addressNormalization` vectors (3), both gateways | HOLDS (via gateways — F1) |
| I8 | Token encoding UTF-8 safe; ASCII contract on both sides | `proof.ts:101-112, 121` | non-ASCII rejection test; vectors "non-ASCII nonce/address" | HOLDS |
| I9 | Decode is bounded before parsing | `proof.ts:155-157` | "rejects malformed tokens" (`:88`); vector "oversized" | HOLDS |
| I10 | Parsing is pollution-safe (field-by-field copy) | `proof.ts:115-134` | review; unknown keys ignored (probe) | HOLDS (code-only) |
| I11 | Challenge fetched only over https, with a timeout, no redirects | `challenge.ts:10-14, 63-65` | hardening tests (`:41-66`, `:101`) | HOLDS (cache mode unset — F11) |
| I12 | Challenge response size-checked before buffering | `challenge.ts:17-44` | `tests/challenge.test.ts:80, 101` | HOLDS |
| I13 | Challenge response fully validated (nonce alphabet + positive expiry) | `challenge.ts:78-84` | `:22`, `:80` | HOLDS |
| I14 | The wallet is prompted only for a proof the gateways can accept | `proof.ts:177-205` | "refuses malformed inputs before asking the wallet to sign" (`:120`) | PARTLY — bad address / expired challenge reach the prompt (F14) |
| I15 | The signed message identifies its audience (origin, gate, network, consume) | `proof.ts:57-66, 91-96` | vectors `audienceMismatch` (8, each bound field) with an independent verifier | HOLDS (wallet display is a Risk) — F9 |
| I16 | The response contract (status, body, conflict codes) is defined once | `contract.ts` | `tests/contract.test.ts` | HOLDS here; walrus-client adoption pending — F15 |
| I17 | `SECURITY.md` matches the code | `SECURITY.md` invariants 1–5 | review 2026-10-09 | HOLDS |
| I18 | Signed-challenge protocol: versioned, domain-separated, ASCII, verifier rebuilds from its own configuration, shared vectors with negatives for every bound field (AUTH) | `proof.ts:4, 57-66`; gateway `verify` | `audienceMismatch`, `negativeSignatures` (8), `zip215`; both gateways consume the same file | HOLDS — F9, F16 |
| I19 | No token, signature or proof reaches logs or errors | `src/` has no `console`; error texts carry no field values except the gateway URL | review | HOLDS (F26 for the URL) |

---

## Section B — Supply-chain, publish-authority & capability matrix

### B.1 Dependency & CVE risk

`npm audit --audit-level=high`: **0 vulnerabilities** (2026-10-09). There are no runtime dependencies,
so consumers inherit nothing from this package.

| Dependency | Pinned (installed) | Liveness dependency? | CVE / audit status | Notes |
| --- | --- | --- | --- | --- |
| *(runtime)* none | — | — | — | uses platform globals only: `fetch`, `AbortSignal.any`/`timeout`, `TextEncoder`/`TextDecoder`, `atob`/`btoa` (F20, F24) |
| `typescript` (dev) | `~6.0.3` (6.0.3) | build (declarations) | clean | 7.0.2 available; TypeScript 7 deferred (decision) |
| `vitest` (dev) | `~5.0.2` (5.0.2) | tests | clean | 5.0.3 available (Dependabot) |
| `eslint` / `typescript-eslint` / `jiti` (dev) | `^10.11.0` / `^8.70.1` / `^2.7.0` (10.11.0 / 8.70.1 / 2.7.0) | lint | clean | newer patch releases pending in Dependabot |
| `@mysten/sui` (dev) | `^2.35.0` (2.35.0) | tests only: independent signature verifier | clean | not shipped; within the ADR-0001 `^2.33.1` baseline |
| `@noble/curves` / `@noble/hashes` (dev) | `^2.4.0` (2.4.0) | `scripts/gen-vectors.mjs` only | clean | not shipped; builds the high-S and ZIP-215 vectors |
| `@types/node` (dev) | `~24.12.2` (24.12.4) | types | clean | Node 24 LTS; `@types/node` 26 declined (decision) |
| Gateway `/v1/challenge` (caller-supplied host) | — | `fetchChallenge` — fails **closed** (throws) | n/a | https only; no redirects (F11) |

**TS lens shared-dependency matrix row (this repo):**

| Package | dependency | devDependency | peer |
| --- | --- | --- | --- |
| `@mysten/sui` | — | `^2.35.0` | — |
| `@mysten/walrus`, `@mysten/walrus-wasm`, `@mysten/seal`, `@mysten/wallet-standard`, `@mysten/bcs` | — | — | — |
| `vue` | — | — | — |
| `typescript` | — | `~6.0.3` | — |
| `vitest` | — | `~5.0.2` | — |

No deviation from the ADR-0001 baseline. `@mysten/sui` is a dev dependency only and is never in the
published bundle, so TS-M9 (peer declaration) is N/A. Downstream, the first-party consumers
(`gateway-workers`, `walrus-client`, `docs`) declare `^0.0.16`, which resolves exactly to the latest
published version.

**SUI_CLIENT lens rows:**

- **Sui SDK:** none at runtime; `@mysten/sui` 2.35.0 in tests as the independent verifier.
- **Transport:** none to the chain.
- **RPC endpoints:** none.
- **Conformance vectors:** `vectors.json` in this package (generated, published, asserted in
  `tests/vectors.test.ts`); vendored in `nft-gate/conformance/vectors.json` and asserted by both gateway
  suites.

### B.2 Publish authority, capabilities & secret custody

| Authority / capability / secret | Where minted / held | Custody | Gates | Immutability / rotation plan |
| --- | --- | --- | --- | --- |
| npm publish `@meddleware/nft-gate-client` | `npm-publish.yml` (tag `v*`) | GitHub OIDC → npm trusted publisher; `--provenance` | package releases | n/a (no token) |
| Private keys | — | **never held** (caller-supplied signer); the vector generator uses throw-away test keys | signing | n/a |

#### CI & release integrity

| Item | Holds? | Evidence |
| --- | --- | --- |
| Actions pinned | Yes | SHA pins with version comments in both workflows |
| Least privilege | Yes | top-level `contents: read`; `id-token: write` only in `publish-npm` |
| OIDC trusted publishing | Yes | `npm publish --provenance`; registry attestation present for 0.0.16 |
| Tag-gated, idempotent publish | Yes | `on: push: tags: v*`; tag/version check; registry probe + conflict tolerance |
| Container images | N/A | none |
| Secrets never echoed | Yes | no secrets in either workflow |
| Real funds are manual | N/A | no chain interaction |
| Test-only modes | N/A | none |

### B.TS-1 Packaging

| Check | Requirement | Holds? |
| --- | --- | --- |
| `exports` / `types` | correct per runtime; types resolvable | Yes — `types` → `dist/index.d.ts` (built by `prepublishOnly`), `default` → `src/index.ts`; `./vectors.json` export; ESM `.js` specifiers resolve to `.ts` under bundlers (Vite, wrangler/esbuild) |
| `files` | explicit whitelist; no tests, fixtures, env files or keys | Yes — `src`, `dist`, `vectors.json`, `CHANGELOG.md` (+ npm defaults); pack verified, 15 files |
| `sideEffects` | accurate | Yes — `false`; no module has import-time effects |
| Ships-source packages type-check under consumers' settings | | Partly — consumers get the `.d.ts`; the `.ts` source is strict + `noUncheckedIndexedAccess`; the gateway-workers and walrus-client builds compile it (their CI) |

### B.TS-2 Install-time code

| Item | Reason |
| --- | --- |
| `prepublishOnly: npm run build` | emit `.d.ts` before every publish |
| Dev-dependency install scripts | `fsevents` (optional, macOS only, via vitest/chokidar) |
| `allowScripts` / `overrides` | none |

### B.TS-3 Supply-chain gates

- Lockfile committed; `npm ci` in every job: **yes**.
- npm client pinned in publish (`npm@11.20.0`): **yes**.
- `npm audit --audit-level=high` in CI **and** publish: **yes**. No allowlist is needed (0 advisories).

### B.AUTH-1 Key & credential inventory

| Key / credential (name only) | Type / algorithm | Where held | Who can read it | Rotation cadence · last rotated | Compromise procedure |
| --- | --- | --- | --- | --- | --- |
| *(none)* | — | the package holds no key, secret or client credential | — | n/a | n/a |
| Access proof token | base64(JSON) bearer | caller memory → request header | the gateway it is sent to | per request; nonce is single-use and expires in 300 s | gateway-side nonce and redemption stores |

Publish credentials: base §B.2 (OIDC, no long-lived token).

### B.AUTH-2 Client & authorization inventory

N/A. The package registers no OAuth client and checks no authorization relation. Authorization is the
gateways' (`nft-gate` audits).

### B.AUTH-3 Protocol conformance

| Protocol | Spec followed | Deviations | Test that pins the wire shape |
| --- | --- | --- | --- |
| nft-gate access proof | `nft-gate:access:v2`, defined by this package (`README.md` "Wire protocol", `src/proof.ts`) | none | `vectors.json` (`personalMessage`, `proofDecode`, `signatures`, `audienceMismatch`), asserted in `tests/vectors.test.ts` and both gateways |
| Gateway response contract | `src/contract.ts` | none | `tests/contract.test.ts`; gateway suites |

### B.SC-1 ID-constant trace

N/A — the package contains no package, object or type ID. In-repo IDs: none. Test fixtures use a fixed
synthetic gate id (`0xa1…a1`), `0xabc` and a synthetic digest.

### B.SC-2 Coupling table

N/A — no Move calls since 0.0.13.

### B.SC-3 Cross-implementation parity

The parity table's home is `nft-gate/gateway-workers/docs/audit/gateway-workers-audit.md` §B.SC-3. This
package is the **TypeScript reference implementation** of the rows "Personal message bytes" and "Proof
decode", because the Workers gateway imports it, and it publishes the vectors both gateways test against.

| Behaviour | This package | Rust gateway | Shared vector | Tracked |
| --- | --- | --- | --- | --- |
| Message bytes (v2: origin, gate, network, nonce, consume) | `personalMessage` | `personal_message` | `personalMessage`, `personalMessageRejects`, `audienceMismatch` ✓ | F9 |
| Field grammar (address, nonce, signature, digest) | `requireProofShape` | `decode_access_proof` | `proofDecodeRejects` (16) ✓ | F10 |
| `consumeDigest` type / `consume_digest` key | non-string rejected; snake key ignored | same | ✓ | F10 |
| base64 strictness (padding, whitespace, trailing bits) | lenient (`atob`) | strict (`STANDARD`) | none | F24 (accepted) |
| UTF-8 strictness | replacement characters | strict | none | F24 |
| Response contract (409 `code`) | `contract.ts` | emits `code` (`main.rs:252-260`) | none (`responses` vectors not added) | F15 |

---

## Section C — Test-coverage & hermetic/live split

### C.1 Coverage grade

`vitest run` (Node environment) gives **80 tests passed** in 4 files: `challenge.test.ts` 11,
`contract.test.ts` 3, `proof.test.ts` 13, `vectors.test.ts` 53 (one test case per vector). No coverage
tool is configured (Suggestion S1).

| Dimension | Assessment |
| --- | --- |
| Happy-path coverage | covered: challenge (camelCase, path prefix, loopback), message derivation (ownership and single-use), encode/decode round trip, `buildAccessProof` with and without digest, `parseGatewayError`, four real signature schemes verified by the Sui SDK |
| Error-path coverage | covered: non-2xx, missing / empty / non-ASCII nonce, non-numeric / non-positive expiry, non-JSON, oversized (declared and streamed), redirect option, invalid host, http host, timeout, caller abort, malformed and oversized token, 16 decode-reject vectors, 13 message-reject vectors, malformed inputs (signer not called). **Missing:** a real 302 response (the option is asserted), `cache`/`credentials` options (F11), a bad address / expired challenge before the prompt (F14) |
| Boundary coverage | covered: 4097-character token, 129-character nonce, 45-character digest, `0OIl` alphabet, 64-digit address. **Missing:** canonical-base64 negative vectors (F24), base58 decoded-length edges (F18) |
| Security-relevant coverage | the published vectors pin the format with real signatures: 8 audience-mismatch cases (each bound field, plus v1), 8 negative signatures (high-S on both curves, non-canonical ed25519 `s`, wrong intent, truncated, multisig / zkLogin / passkey flags fail closed), ZIP-215. The Sui SDK verifier is the independent implementation |

TS lens §C:

| Requirement | Holds? |
| --- | --- |
| Unit, integration and e2e listed separately | unit only; no env-gated tests in this package. The live path is exercised by consumers (C.2) |
| Parse failures tested (oversize, wrong types, missing fields, non-ASCII) | yes |
| Wire format has golden vectors | yes — published and shared (F16) |
| `tsc --noEmit` in CI | yes |
| Every test project runs in CI | yes (one project) |

AUTH lens §C (signed-challenge protocols): the shared vectors include a wrong-audience case for each bound
field, and every implementation consumes the same published file — **holds**.

### C.2 Hermetic vs. live paths

| Path | Hermetic unit test? | Deferred to | Tracking |
| --- | --- | --- | --- |
| Challenge fetch against a real gateway (CORS, headers, redirect behaviour) | mocked `fetch` only | consumers' live runs; the 2026-10-09 paywall e2e (operator relay) passed through the live Worker | F11 |
| Proof accepted by a real gateway | no | `nft-gate` suites (Workers imports this decoder) and the live paywall e2e (pass bought, consumed, v2 proof, upload; indexer minted=1 consumed=1) | F16 |
| Wallet signing (`sui:signPersonalMessage`) | stub signer; vectors verified with the Sui SDK | consuming apps' e2e | n/a |

---

## Section D — Deployment-readiness gates

### pre-localnet

- [x] builds (`tsc --noEmit`, declaration build); unit tests green (80); lint clean — 2026-10-09
- [x] no secrets in source; no runtime dependencies; clean install — F23
- [x] untrusted parsers validate size and every field — token: F3/F8/F10; challenge: F12, F13
- [x] no swallowed promises on security paths — none in `src/`

### pre-testnet *(consumers already run on testnet)*

- [x] npm pack contents verified; B.TS-2 inventory complete — B.TS-1/2
- [x] shared-dependency matrix aligned with ADR-0001 — B.1 (no runtime `@mysten/*`; dev `^2.35.0`)
- [x] `npm audit` gate in CI and publish — F7, F21
- [x] every test project runs in CI — C.1
- [x] `SECURITY.md` present and accurate — F16
- [x] parity vectors (including negatives) cover the decoder's field grammar and every audience field —
  F10, F16 (base64-layer strictness is the accepted residual F24)
- [x] challenge fetch refuses redirects — F11 (cache mode left to default; gateways send no freshness
  headers)
- [x] signed-challenge protocol versioned and audience-bound; negative vectors in every implementation
  (AUTH) — F9

### pre-mainnet

- [x] signed message bound to an audience (coordinated with both gateways) — F9; released 0.0.16 and
  deployed in the Worker, live-checked 2026-10-09
- [x] response contract defined and shared — F15 (defined here, emitted by both gateways; walrus-client
  adoption is tracked in its audit)
- [x] every fetch has a timeout — `challenge.ts:63-64`
- [x] no raw `btoa`/`atob` on untrusted text — UTF-8 round trip on encode; ASCII contract on both sides
  (F2). The base64 layer's strictness is F24.
- [ ] no `as` at trust boundaries without an inline justification — `challenge.ts:77`, `proof.ts:161`,
  `contract.ts:45` (F25, Suggestion S4); a pre-mainnet maintainer code edit
- [ ] external review — maintainer / after launch: `OPERATOR_TASKS.md`, "Funding, grants and an external
  audit — after launch"

---

## Cross-project themes

- **Supply chain & release integrity:**
  - The lockfile is committed and actions are SHA-pinned.
  - `npm audit` gates CI and publish; Dependabot groups weekly updates.
  - Publishing uses OIDC with provenance, verified on the registry.
  - There are no runtime dependencies, which is the strongest posture in the corpus for a package on
    a gateway's verification path.
- **Wire-format coupling & conformance vectors:**
  - The format is **defined here** and documented in `README.md`, root `nft-gate/CLAUDE.md` and this
    audit.
  - It is implemented here (client, and the Workers gateway via import) and in
    `nft-gate/gateway-rust/src/proof.rs`.
  - Drift is detected by `vectors.json`, generated and published here, asserted here with an independent
    verifier, and consumed by both gateways. The decoder strictness the vectors miss is the base64 layer
    (F24). The response side now has a defined contract but no vectors (F15).
- **On-chain-truth boundary:** the package decides nothing. The address is emitted raw and
  canonicalised by the gateways (F1). Single-use accounting is on-chain plus the gateway's
  redemption store.
- **Deployment readiness:** Section D. The package ships and runs live through its consumers.
- **Chain-access layering & on-chain ID/ABI coupling:**
  - It conforms to ADR-0001: since 0.0.13 all `access_gate` builders and reads live in
    `@meddleware/access-gate-client`, and this package is protocol-only (`CLAUDE.md` "Wire protocol
    only").
  - IDs: none held. ABI coupling: none. Move git dependencies: N/A.
  - Pre-v0.2 policy: 0.0.16 removed the snake_case `expires_at` path and shipped the v2 message with no
    v1 compatibility (patch-only bumps until go-live, breaking changes included).

---

## Normative requirements (MUST / MUST NOT)

1. MUST define one strict token field grammar, applied on encode and decode, mirrored in the Rust
   gateway, with `proofDecodeRejects` vectors — **holds** (F10). The base64 layer is lenient —
   **does not hold, accepted** (F24).
2. MUST assert the shared conformance vectors in this package's own tests, from a single agreed home —
   **holds** (F16).
3. MUST refuse redirects on the challenge fetch — **holds** (F11). MUST NOT cache the nonce — **holds in
   effect** (no freshness headers; cache mode unset).
4. MUST bound the challenge read before buffering and require a valid `expiresAt` — **holds** (F12, F13).
5. MUST NOT prompt the wallet for a proof every gateway would reject: nonce, gate, network, origin and
   digest are checked before signing; address, signature and expiry are not — **partly holds** (F14).
6. MUST keep `SECURITY.md`, `README.md` and the JSDoc accurate to the code — **holds, with doc nits**
   (F16, F17).
7. MUST bind the signed message to its audience (gateway origin, gate, network; the consume digest in
   single-use mode), versioned, coordinated with both gateways and the vectors — **holds** (F9).
8. MUST define the response contract (status codes, error body, conflict codes) here — **holds**;
   header names and `responses` vectors are not part of it (F15).

**Lens baseline MUST lists.**

TS lens:

| ID | Holds? | Evidence |
| --- | --- | --- |
| TS-M1 | strict holds; three `as` casts lack an inline justification | F25, Suggestion S4 |
| TS-M2 | holds for the token's fields and size, the challenge read and the field grammar; the base64/UTF-8 layer is lenient | F10, F12, F13, F24 |
| TS-M3 | N/A (no amounts) | |
| TS-M4 | holds | |
| TS-M5 | holds — the timeout, `new URL` and the redirect policy exist | F11 |
| TS-M6 | holds (the gateway URL is echoed in two error texts) | F23, F26 |
| TS-M7 | holds | B.TS-1, B.TS-2 |
| TS-M8 | holds | B.TS-3 |
| TS-M9 | N/A (`@mysten/sui` is a dev dependency only; no runtime SDK) | B.1 |

SUI_CLIENT lens:

| ID | Holds? | Evidence |
| --- | --- | --- |
| SC-M1, SC-M2, SC-M3, SC-M8, SC-M9 | N/A (no IDs, reads, executions or PTBs) | |
| SC-M4 | holds by delegation (the address is emitted raw; gateways normalise, vector-pinned) | F1 |
| SC-M5 | N/A for IDs; the network is bound in the message and rebuilt by the gateway from its own configuration | F9 |
| SC-M6 | holds for the client half: the published vectors carry real signatures for three schemes, high-S, ZIP-215, wrong intent and fail-closed flags, verified by the Sui SDK, and every gateway consumes them | F16 |
| SC-M7 | N/A (no events read); the client half of the binding is F9 (consume digest in the signed message) | |
| SC-M10 | holds (protocol-only package; domain logic in access-gate-client) | |

AUTH lens:

| ID | Holds? | Evidence |
| --- | --- | --- |
| AUTH-M1 – AUTH-M10 | N/A (no tokens issued or verified, no IdP, no browser session, no proxy, no user-supplied third-party token) | |
| AUTH-M11 | holds for the client half: versioned `nft-gate:access:v2`, binds origin, gate, network, nonce and consume digest; the gateway rebuilds it from its own configuration | F9, I18 |

## Implementation suggestions (SHOULD / MAY)

- **S1** SHOULD enable `@vitest/coverage-v8` and record the figure. The surface is small enough for
  100 % line and branch coverage to be cheap.
- **S2** SHOULD add a property test: for random valid `{address, nonce, signature, consumeDigest?}`,
  `decodeAccessProof(encodeAccessProof(p))` equals `p`. Run the same generator in the Rust gateway's
  proptests for differential coverage.
- **S3** MAY export `MAX_TOKEN_BYTES` (and the challenge cap) so gateways import the limits instead of
  restating them.
- **S4** SHOULD add a one-line justification beside the three narrowing casts (TS-M1), or replace them
  with a small type guard (F25).
- **S5** MAY expose an `accessProofHeaders(token)` and `isRedeemedConflict(err)` helper (the rest of
  F15) so no consumer hand-writes `Bearer` or a message-regex fallback.
- **S6** SHOULD add `npm pack --dry-run` with an asserted file list to Node CI, drop `--if-present`, and
  add lint to the publish `verify` job (F19).
- **S7** MAY add `"engines": { "node": ">=24" }`, align `AGENTS.md`, and fix the duplicated README
  bullet (F17, F20).
- **S8** MAY pass `cache: 'no-store'` and `credentials: 'omit'` in `fetchChallenge` (F11).

## Open questions

- **OQ1** Which side owns address canonicalisation: the client (a breaking wire change) or the gateways?
  (Decided 2026-10-03, recorded retroactively, as the decision predates this pass: **gateway-side**
  canonicalisation in both gateways, with an `addressNormalization` vector; the client emits the raw
  address — see F1.)
- **OQ2** Are non-ASCII nonces or addresses ever possible? (Decided 2026-10-03, recorded retroactively:
  **no** — the ASCII contract is enforced by this package and both gateways — see F2.)
- **OQ3** Should `decodeAccessProof` reject empty or shape-invalid fields? (Decided 2026-10-08, release
  0.0.16: **yes** — address `0x` + 1–64 hex, nonce `[A-Za-z0-9._~-]{1,128}`, base64 signature, base58
  digest; rejected on encode and decode, in Rust and in the vectors — see F3, F10.)
- **OQ4** Should `@mysten/sui` stay on a floating `^2.x`? (Decided 2026-09-30, 0.0.13: **no runtime
  dependencies** — `@mysten/sui` removed — see F5. It is a dev dependency only since 0.0.16.)
- **OQ5** Message v2 binding fields. (Decided 2026-10-08, release 0.0.16: **gateway origin + gate id +
  network + the consume digest in single-use mode**, in a multi-line ASCII form a wallet can display; one
  decision for this package, `nft-gate` and walrus-client — see F9.)
- **OQ6** Where should the conformance vectors live? (Decided 2026-10-08, release 0.0.16: **(b)** generated
  and published from this package as `exports["./vectors.json"]`; the Workers gateway consumes the
  package, the Rust gateway a vendored copy checked in CI — see F16.)
- **OQ7** Should the response contract be part of this package's public API? (Decided 2026-10-08,
  release 0.0.16: **yes** — `contract.ts`; the helpers `isRedeemedConflict` and `accessProofHeaders` and
  `responses` vectors are not yet part of it — see F15.)
- **OQ8** Should the lenient base64 / invalid-UTF-8 layer be made strict in both gateways (F24)? Open: a
  maintainer decision, to be taken before the Rust gateway is deployed or at the pre-mainnet review.

## Risks

- **Wallet display.** Even with F9 fixed, protection depends on wallets showing the message and users
  noticing a wrong origin: a phishing site can ask a victim to sign a message that names the **real**
  gateway, gate and network, and the resulting proof is valid there for one request within the nonce TTL
  (and, in single-use mode, for the digest the victim chose to sign).
- **Platform globals.** `fetch`, `atob` and `TextDecoder` semantics differ slightly across browsers,
  Node and workerd. The field grammar removes the differences that decide access; the base64 layer is F24.
  The runtime floor is F20.
- **Coordinated releases.** Every wire change needs this package, both gateways, the vectors and
  walrus-client released together. Pre-v0.2 there is no compatibility window, so a partial rollout
  breaks uploads until all parts ship. (0.0.16 was rolled out this way on 2026-10-08/09.)
- **Dev-toolchain supply chain.** 176 dev packages, including the eslint and vitest ecosystems and the Sui
  SDK. They are not shipped, but they run in CI with publish credentials one job away. The control is the
  `npm audit` gate plus the job split, with `id-token` only in the publish job.

---

## Re-verification log

- 2026-09-18 — First-pass baseline (npm 0.0.8): F1–F8 and OQ1–OQ4. F1, F2, F3, F5 and F7 were later
  marked RESOLVED in that file. F4 was ADJUDICATED; F6 and F8 were Positive.
- 2026-10-03 — Re-verified at `8b10335` (tag `v0.0.15`, npm 0.0.15 with provenance) under the then-current
  base template and the TS and SUI_CLIENT lenses.
  - Relocated to `nft-gate-client/docs/audit/`, with all IDs kept.
  - F1, F2, F3, F7 and F8 re-verified as still holding.
  - F4, F5 and F6 are superseded by the 0.0.13 reduction to wire-protocol-only; their code moved to
    `@meddleware/access-gate-client`.
  - Recorded the decisions on OQ1, OQ2 and OQ4, retroactively, since they were taken before this pass.
  - Added F9–F20 (issues) and F21–F23 (Positive), plus OQ5–OQ7.
  - Measured: vitest 20 passed; tsc and eslint clean; `npm audit` 0; pack 12 files.
  - No new finding resolved: this pass only recorded findings.
- 2026-10-09 — Re-verified at `ed876ba` (release `0.0.16`, tag `v0.0.16` at `e114369`, published
  2026-10-08 with provenance) under the base (2026-10-08), TS (2026-10-08), SUI_CLIENT (2026-10-08) and
  AUTH (2026-10-08) lenses. Read: `CHANGELOG.md`, `git log`, `src/`, `tests/`, `vectors.json`,
  `scripts/gen-vectors.mjs`, workflows, and the Rust and Workers decoders (read-only).
  - Dispositions: F1, F2, F3, F5, F7, F9, F12, F13, F16 RESOLVED; F10, F11, F14, F15, F17, F18
    MITIGATED; F4 ADJUDICATED; F19, F20 ACCEPTED-RISK; F6, F8, F21–F23 Positive. Evidence is release
    0.0.16 (`e114369`, "Access message v2 (audience-bound), strict proof/challenge parsing, published
    vectors") plus `tests/vectors.test.ts`.
  - Added F24 (lenient base64 layer, ACCEPTED-RISK, found by a decoder probe), F25 (casts without a
    justification, DEFERRED to the pre-mainnet gate) and F26 (gateway URL echoed in error texts,
    ACCEPTED-RISK); added OQ8; decided OQ3, OQ5, OQ6 and OQ7.
  - AUTH lens added to the Template list (B.AUTH-1/2/3, identity & credential matrix, I18, AUTH-M11,
    signed-challenge coverage). Template dates updated; the Deployment status, front matter, Sections A–D,
    normative lists and counts were refreshed.
  - Measured: vitest 80 passed (4 files); `tsc --noEmit`, `eslint .` and `check:vectors` clean;
    `npm audit` 0; pack 15 files; `npm view` 0.0.16 with provenance. Live: paywall e2e PASS 2026-10-09
    through a v2 proof.
  - Section D: all gates ticked except the cast justification (F25) and external review (maintainer,
    `OPERATOR_TASKS.md`).
  - Pre-save consistency checklist run.

## Pre-save consistency checklist (this pass)

- [x] Section A ↔ findings — GAP/PARTLY rows cite F24, F14, F15; HOLDS rows cite resolved or positive ones.
- [x] Finding header ↔ body — every header disposition matches the body and the Status line counts (26
  findings: 9 RESOLVED, 6 MITIGATED, 1 ADJUDICATED, 4 ACCEPTED-RISK, 1 DEFERRED, 5 Positive).
- [x] Template line: base + TS + SUI_CLIENT + AUTH with dates; WALRUS, VUE, IMG, OPS, PROXY, WORKERS, SEAL
  and PLATFORM not-triggered noted.
- [x] Closing structure in order.
- [x] Open questions: none deleted or renumbered. OQ3, OQ5, OQ6 and OQ7 now carry `(Decided …)` notes;
  OQ8 is open.
- [x] Section D ↔ dispositions.
- [x] Executive summary reflects current dispositions.
- [x] Counts and versions re-measured 2026-10-09.
- [x] Re-verification log entry added.
