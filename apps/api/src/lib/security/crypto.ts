import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

/**
 * Application-Level-Encryption für sensible Felder (Mandantenname, Sachverhalt).
 * Nutzt ChaCha20-Poly1305 (Node-built-in, FIPS-äquivalent zu libsodium-secretbox).
 * Per-Org-Key, hex-encoded, in ENV `KD_ENCRYPTION_KEYS=org1:hex,org2:hex`.
 *
 * Format: base64url(nonce(12) | ciphertext+tag).
 *
 * Phase 4 produktiv: Keys in KMS (AWS, Hetzner Vault) statt ENV.
 */

const NONCE_BYTES = 12
const KEY_BYTES = 32

const keyCache = new Map<string, Buffer>()
let envSnapshot: string | undefined = undefined

function loadKeysFromEnv(): void {
  const raw = process.env.KD_ENCRYPTION_KEYS
  if (raw === envSnapshot) return
  keyCache.clear()
  envSnapshot = raw
  if (!raw) return
  for (const pair of raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)) {
    const idx = pair.indexOf(':')
    if (idx <= 0) continue
    const orgId = pair.slice(0, idx)
    const hex = pair.slice(idx + 1)
    if (hex.length !== KEY_BYTES * 2) continue
    keyCache.set(orgId, Buffer.from(hex, 'hex'))
  }
}

export function getOrgKey(orgId: string): Buffer | null {
  loadKeysFromEnv()
  return keyCache.get(orgId) ?? null
}

function toBase64Url(buf: Buffer): string {
  return buf.toString('base64url')
}

function fromBase64Url(s: string): Buffer {
  return Buffer.from(s, 'base64url')
}

export function encryptForOrg(orgId: string, plain: string): string | null {
  const key = getOrgKey(orgId)
  if (!key) return null
  const nonce = randomBytes(NONCE_BYTES)
  const cipher = createCipheriv('chacha20-poly1305', key, nonce, { authTagLength: 16 })
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return toBase64Url(Buffer.concat([nonce, ct, tag]))
}

export function decryptForOrg(orgId: string, blob: string): string | null {
  const key = getOrgKey(orgId)
  if (!key) return null
  const bytes = fromBase64Url(blob)
  if (bytes.length < NONCE_BYTES + 16) return null
  const nonce = bytes.subarray(0, NONCE_BYTES)
  const tag = bytes.subarray(bytes.length - 16)
  const ct = bytes.subarray(NONCE_BYTES, bytes.length - 16)
  const decipher = createDecipheriv('chacha20-poly1305', key, nonce, { authTagLength: 16 })
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8')
}

export function generateMasterKeyHex(): string {
  return randomBytes(KEY_BYTES).toString('hex')
}
