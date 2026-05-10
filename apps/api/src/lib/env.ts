import { z } from 'zod'

const Env = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string().default('file:./data/app.db'),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-4-6'),
  SESSION_COOKIE_NAME: z.string().default('kdsess'),
  /** Comma-separated list of allowed origins for production. */
  CORS_ORIGINS_PROD: z.string().optional(),
})

export type AppEnv = z.infer<typeof Env>

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsed = Env.safeParse(source)
  if (!parsed.success) {
    throw new Error(`Ungültige ENV-Variablen: ${parsed.error.message}`)
  }
  return parsed.data
}
