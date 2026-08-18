#!/usr/bin/env node
import { parseArgs } from 'node:util'

import { createRelay } from '../src/node.js'

// A relay you can start in one command. Development, self-hosting, and the test
// suite's "two peers converge" all run through this.

const { values } = parseArgs({
  options: {
    port: { type: 'string', short: 'p', default: process.env.PORT ?? '1234' },
    host: { type: 'string', short: 'h', default: process.env.HOST ?? '127.0.0.1' },
    storage: { type: 'string', short: 's', default: process.env.RELAY_STORAGE },
    admin: { type: 'string', short: 'a', default: process.env.RELAY_ADMIN },
    help: { type: 'boolean' },
  },
})

if (values.help) {
  console.log(`
  single-studio-relay [options]

    -p, --port     port to listen on           (default 1234, or $PORT)
    -h, --host     interface to bind           (default 127.0.0.1, or $HOST)
    -s, --storage  directory to persist rooms  (default: memory only, $RELAY_STORAGE)
    -a, --admin    secret for the token API     (default: off, $RELAY_ADMIN)

  Connect a studio to ws://<host>:<port> with any room name.

  A room nobody has issued a token for is open. Issue one and it is guarded:

    curl -XPOST localhost:1234/friday/tokens -H "authorization: Bearer $RELAY_ADMIN" \
         -d '{"name":"Sam"}'
    curl localhost:1234/friday/tokens -H "authorization: Bearer $RELAY_ADMIN"
    curl -XDELETE localhost:1234/friday/tokens/<id> -H "authorization: Bearer $RELAY_ADMIN"
`)
  process.exit(0)
}

const relay = createRelay({ storage: values.storage, admin: values.admin })
const { port, close } = await relay.listen(Number(values.port), values.host)

console.log(`[relay] listening on ws://${values.host}:${port}`)
console.log(`[relay] storage: ${values.storage ?? 'memory only — rooms are lost when this stops'}`)
console.log(values.admin ? '[relay] token API enabled at /<room>/tokens' : '[relay] no --admin secret: the token API is off, and rooms without tokens are open')

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    console.log('\n[relay] saving and shutting down')
    await close()
    process.exit(0)
  })
}
