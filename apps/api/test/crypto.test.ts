import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { decryptForOrg, encryptForOrg, generateMasterKeyHex } from '../src/lib/security/crypto'

const ORIG_ENV = process.env.KD_ENCRYPTION_KEYS

beforeEach(() => {
  process.env.KD_ENCRYPTION_KEYS = `org-A:${'a'.repeat(64)},org-B:${'b'.repeat(64)}`
})

afterEach(() => {
  process.env.KD_ENCRYPTION_KEYS = ORIG_ENV
})

describe('Application-Level-Encryption', () => {
  it('encrypt → decrypt → original', () => {
    const cipher = encryptForOrg('org-A', 'Mandantenname Müller')
    expect(cipher).toBeTruthy()
    const plain = decryptForOrg('org-A', cipher!)
    expect(plain).toBe('Mandantenname Müller')
  })

  it('cipher ist nicht deterministisch (Nonce ist zufällig)', () => {
    const a = encryptForOrg('org-A', 'Foo')
    const b = encryptForOrg('org-A', 'Foo')
    expect(a).not.toBe(b)
  })

  it('Cross-Org-Decrypt schlägt fehl (Authentifizierung)', () => {
    const cipher = encryptForOrg('org-A', 'Geheim')
    expect(() => decryptForOrg('org-B', cipher!)).toThrow()
  })

  it('Key fehlt → null', () => {
    const r = encryptForOrg('org-X-not-configured', 'Foo')
    expect(r).toBeNull()
  })

  it('generateMasterKeyHex liefert 64 Hex-Zeichen', () => {
    const k = generateMasterKeyHex()
    expect(k).toMatch(/^[0-9a-f]{64}$/)
  })
})
