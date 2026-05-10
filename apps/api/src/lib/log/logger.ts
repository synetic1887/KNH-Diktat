import pino from 'pino'

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g

/** Maskiert PII in Log-Strings: E-Mails → `***@***`, lange Texte → `[redacted N chars]`. */
export function maskPii(value: unknown): unknown {
  if (typeof value === 'string') {
    let s = value.replace(EMAIL_RE, '***@***')
    if (s.length > 60) s = `[redacted ${s.length} chars]`
    return s
  }
  if (Array.isArray(value)) return value.map(maskPii)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      if (/instruction|content|sectionContent|sections|message|payload|password/i.test(k)) {
        out[k] = typeof v === 'string' ? `[redacted ${v.length} chars]` : '[redacted]'
      } else {
        out[k] = maskPii(v)
      }
    }
    return out
  }
  return value
}

export function createLogger(env: 'development' | 'test' | 'production') {
  const transport =
    env === 'development'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } }
      : undefined
  return pino({
    level: env === 'test' ? 'silent' : env === 'production' ? 'info' : 'debug',
    transport,
    serializers: {
      req: (req) => ({ method: req.method, url: req.url }),
      res: (res) => ({ statusCode: res.statusCode }),
      err: pino.stdSerializers.err,
    },
    formatters: {
      log(obj) {
        return maskPii(obj) as Record<string, unknown>
      },
    },
  })
}

export type Logger = ReturnType<typeof createLogger>
