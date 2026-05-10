import { serve } from '@hono/node-server'

import { createApp } from './app'
import { applySchema, openDb } from './db/db'
import { ensureSeed } from './db/seed'
import { AnthropicProvider } from './lib/ai/AnthropicProvider'
import type { AIProvider } from './lib/ai/AIProvider'
import { loadEnv } from './lib/env'
import { createLogger } from './lib/log/logger'

const env = loadEnv()
const logger = createLogger(env.NODE_ENV)
const dbHandle = openDb(env.DATABASE_URL)
applySchema(dbHandle.raw)
await ensureSeed(dbHandle.db)

const provider: AIProvider | null = env.ANTHROPIC_API_KEY
  ? new AnthropicProvider({ apiKey: env.ANTHROPIC_API_KEY, model: env.ANTHROPIC_MODEL })
  : null
if (!provider) {
  logger.warn('ANTHROPIC_API_KEY nicht gesetzt — KI-Routes liefern 503.')
}

// In Phase-2-Smoke ohne Login: NODE_ENV=development + KD_AI_OPEN=1
const aiOpenForDev = env.NODE_ENV === 'development' && process.env.KD_AI_OPEN === '1'
if (aiOpenForDev) logger.warn('KI-Routes ohne Auth (KD_AI_OPEN=1, nur Dev).')

const app = createApp({ env, db: dbHandle, provider, logger, aiOpenForDev })

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  logger.info(`API hört auf http://localhost:${info.port} (${env.NODE_ENV})`)
})
