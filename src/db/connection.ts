import dns from 'node:dns'

// Neon resolves to both IPv4 and IPv6. On networks without working IPv6 the
// driver spends its connection timeout on unreachable addresses, so prefer
// IPv4. This must run before the first DNS lookup, and doing it here (next to
// the client) covers every entry point: the server, vitest, and scripts.
dns.setDefaultResultOrder('ipv4first')

import { drizzle } from 'drizzle-orm/neon-http'
import config from '../config.js'

const db = drizzle(config.database_url)

export default db
