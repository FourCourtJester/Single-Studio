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
    token: { type: 'string', short: 't', default: process.env.RELAY_TOKEN },
    help: { type: 'boolean' },
  },
})

if (values.help) {
  console.log(`
  single-studio-relay [options]

    -p, --port     port to listen on           (default 1234, or $PORT)
    -h, --host     interface to bind           (default 127.0.0.1, or $HOST)
    -s, --storage  directory to persist rooms  (default: memory only, $RELAY_STORAGE)
    -t, --token    shared token clients must present (default: none, $RELAY_TOKEN)

  Connect a studio to ws://<host>:<port> with any room name.
`)
  process.exit(0)
}

// A shared token is the floor, not the ceiling. Per-operator tokens and a
// revocation path are stage 4 in docs/collaboration.md -- someone leaving a
// production should not mean rotating a secret everyone else has to be told.
const authorize = values.token ? ({ token }) => token === values.token : null

const relay = createRelay({ storage: values.storage, authorize })
const { port, close } = await relay.listen(Number(values.port), values.host)

console.log(`[relay] listening on ws://${values.host}:${port}`)
console.log(`[relay] storage: ${values.storage ?? 'memory only — rooms are lost when this stops'}`)
if (!values.token) console.log('[relay] no token set: anyone who can reach this port can join any room')

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    console.log('\n[relay] saving and shutting down')
    await close()
    process.exit(0)
  })
}
