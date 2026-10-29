import { drizzle } from 'drizzle-orm/neon-http'
import config from '../config.js'

const db = drizzle(config.database_url)

export default db
