import { loadEnv } from '../lib/env'
import { applySchema, openDb } from './db'

function main() {
  const env = loadEnv()
  const handle = openDb(env.DATABASE_URL)
  applySchema(handle.raw)
  process.stdout.write(`✓ Schema angewandt auf ${env.DATABASE_URL}\n`)
  handle.close()
}

main()
