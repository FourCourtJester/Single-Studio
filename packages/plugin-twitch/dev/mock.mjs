// Twitch, without Twitch.
//
// The rocket-league package has `replay.mjs`, a fake game playing a scripted match.
// This is the same idea with one difference that matters: the frames are not ours.
// Twitch ships a mock EventSub server in its own CLI, so the events it sends are
// Twitch's shapes rather than ones typed from the same notes the parser was written
// from -- which means, unlike a script, it can disagree with the parser. That is the
// whole reason to use it instead of writing one.
//
// It also covers what real Twitch makes awkward to test: subs, gifts and cheers cost
// money, a raid needs another channel, and nothing on Twitch will reconnect you on
// demand.
//
//   pnpm --filter @single-studio/plugin-twitch mock
//
// and in the studio's worker, `twitch(MyShow, { mock: true })`. Then press a key.
//
// Written from the CLI's documentation, not run from here -- the environment this was
// built in cannot reach Twitch. If a trigger is refused, the CLI's own message is
// printed, and any line that is not one of the keys is passed to
// `twitch event trigger` as it is, so the fix is typing the right arguments.

import { spawn, spawnSync } from 'node:child_process'
import { createInterface } from 'node:readline'

const has = spawnSync('twitch', ['version'], { encoding: 'utf8', shell: process.platform === 'win32' })

if (has.error || has.status !== 0) {
  console.error(`The Twitch CLI is not installed, or not on PATH.

  Windows   winget install Twitch.TwitchCLI     (or: scoop install twitch-cli)
  macOS     brew install twitchdev/twitch/twitch-cli
  Linux     https://github.com/twitchdev/twitch-cli/releases

No account or configuration is needed for the mock server.`)
  process.exit(1)
}

const KEYS = {
  f: ['channel.follow'],
  s: ['channel.subscribe'],
  r: ['channel.subscription.message'],
  g: ['channel.subscription.gift'],
  c: ['channel.cheer'],
  x: ['channel.raid'],
  m: ['channel.chat.message'],
}

const run = (args) =>
  new Promise((resolve) => {
    const child = spawn('twitch', args, { stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' })
    let said = ''

    child.stdout.on('data', (chunk) => (said += chunk))
    child.stderr.on('data', (chunk) => (said += chunk))
    child.on('close', (code) => resolve({ code, said: said.trim() }))
  })

const trigger = async (args) => {
  const { code, said } = await run(['event', 'trigger', ...args, '--transport=websocket'])

  console.log(code === 0 ? `  sent ${args[0]}` : `  the CLI refused ${args.join(' ')}:\n${said.replace(/^/gm, '    ')}`)
}

const server = spawn('twitch', ['event', 'websocket', 'start-server'], { stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' })

// The server's own log, indented, so it reads as the server talking rather than us.
const echo = (chunk) => process.stdout.write(String(chunk).replace(/^(?=.)/gm, '  │ '))

server.stdout.on('data', echo)
server.stderr.on('data', echo)
server.on('close', (code) => {
  console.log(`The mock server stopped (${code}).`)
  process.exit(code ?? 0)
})

console.log(`Twitch mock EventSub, from the Twitch CLI.

  In the studio's worker:   twitch(MyShow, { mock: true })
  It connects to ws://127.0.0.1:8080/ws and needs no sign-in.

  f follow   s sub   r resub   g gift   c cheer   x raid   m chat
  w reconnect (Twitch's handover)   q quit
  Anything else is passed to \`twitch event trigger\`, e.g. "channel.follow -v 2".
`)

const input = createInterface({ input: process.stdin })

input.on('line', async (line) => {
  const typed = line.trim()

  if (!typed) return
  if (typed === 'q') {
    server.kill()
    input.close()
    return
  }

  if (typed === 'w') {
    const { code, said } = await run(['event', 'websocket', 'reconnect'])

    console.log(code === 0 ? '  asked every client to reconnect' : `  the CLI refused:\n${said.replace(/^/gm, '    ')}`)
    return
  }

  await trigger(KEYS[typed] ?? typed.split(/\s+/))
})

process.on('SIGINT', () => {
  server.kill()
  process.exit(0)
})
