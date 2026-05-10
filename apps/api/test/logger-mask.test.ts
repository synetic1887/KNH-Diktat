import { describe, expect, it } from 'vitest'

import { maskPii } from '../src/lib/log/logger'

describe('maskPii', () => {
  it('maskiert E-Mails in Strings', () => {
    expect(maskPii('Mail an mueller@kanzlei.de geschickt')).toBe('Mail an ***@*** geschickt')
  })

  it('schneidet lange Strings ab', () => {
    const long = 'x'.repeat(100)
    expect(maskPii(long)).toBe('[redacted 100 chars]')
  })

  it('maskiert sensible Felder in Objekten', () => {
    const obj = {
      method: 'POST',
      instruction: 'Sehr geheime Anweisung',
      sectionContent: 'Mandantenname Müller',
      payload: 'irrelevant',
      password: 'secret',
    }
    const out = maskPii(obj) as Record<string, string>
    expect(out.method).toBe('POST')
    expect(out.instruction).toMatch(/redacted/)
    expect(out.sectionContent).toMatch(/redacted/)
    expect(out.payload).toMatch(/redacted/)
    expect(out.password).toMatch(/redacted/)
  })
})
