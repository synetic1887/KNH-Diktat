import { randomBytes } from 'node:crypto'

/** URL-sichere ID, ~22 Zeichen Base64URL aus 16 Bytes Entropie. */
export function newId(): string {
  return randomBytes(16).toString('base64url')
}

export function newSessionId(): string {
  return randomBytes(32).toString('base64url')
}
