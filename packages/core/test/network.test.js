import { describe, expect, it, vi } from 'vitest'

import { addressSpace, gatedBetween, localPermission, promptable } from '../src/toolkits/network'

describe('where an address is', () => {
  it('knows this computer by every name a studio writes it as', () => {
    for (const url of ['ws://localhost:4455', 'ws://127.0.0.1:49124', 'ws://[::1]:8080', 'http://studio.localhost', 'ws://0.0.0.0:1']) {
      expect(addressSpace(url), url).toBe('loopback')
    }
  })

  it('knows the network it is on, which Chrome asks about separately', () => {
    for (const url of [
      'ws://192.168.1.20:4455',
      'ws://10.0.0.5',
      'ws://172.16.0.1',
      'ws://172.31.255.1',
      'ws://169.254.1.1',
      'ws://[fd12::1]',
      'ws://obs.local:4455',
    ]) {
      expect(addressSpace(url), url).toBe('local')
    }
  })

  it('does not mistake the public neighbours of private ranges for private', () => {
    for (const url of ['https://fourcourtjester.github.io', 'ws://172.32.0.1', 'ws://11.0.0.1', 'wss://eventsub.wss.twitch.tv/ws', 'ws://192.169.0.1']) {
      expect(addressSpace(url), url).toBe('public')
    }
  })

  it('says nothing for something that is not an address', () => {
    expect(addressSpace('not a url')).toBeNull()
  })
})

describe('what a studio has to be allowed', () => {
  it('a studio on GitHub Pages reaching OBS on this computer', () => {
    expect(gatedBetween('https://fourcourtjester.github.io/SS-Demo/#/', 'ws://localhost:4455')).toBe('loopback')
  })

  it('the same studio reaching OBS on another machine at home', () => {
    expect(gatedBetween('https://fourcourtjester.github.io/', 'ws://192.168.1.20:4455')).toBe('local')
  })

  it('nothing, for a studio served from this computer', () => {
    // The dev server, or a studio served by a local program. Not a step inwards.
    expect(gatedBetween('http://localhost:5173/#/', 'ws://localhost:4455')).toBeNull()
  })

  it('nothing, for a plugin that talks to the internet', () => {
    expect(gatedBetween('https://fourcourtjester.github.io/', 'wss://eventsub.wss.twitch.tv/ws')).toBeNull()
  })
})

describe('asking the browser', () => {
  const browser = (known) => ({
    query: vi.fn(async ({ name }) => {
      if (!(name in known)) throw new TypeError(`unknown permission ${name}`)

      return { name, state: known[name] }
    }),
  })

  it('takes the newest name the browser knows', async () => {
    const permissions = browser({ 'loopback-network': 'granted', 'local-network-access': 'prompt' })

    expect((await localPermission('loopback', permissions))?.state).toBe('granted')
  })

  it('falls back to the older name in an older browser', async () => {
    // Chromium 141 knows only `local-network-access`.
    const permissions = browser({ 'local-network-access': 'prompt' })

    expect((await localPermission('loopback', permissions))?.state).toBe('prompt')
  })

  it('answers null from a browser that gates nothing, so there is nothing to explain', async () => {
    expect(await localPermission('loopback', browser({}))).toBeNull()
    expect(await localPermission('loopback', undefined)).toBeNull()
  })
})

describe('the request that brings up the prompt', () => {
  it('is the socket’s address as a plain request', () => {
    expect(promptable('ws://localhost:47600/')).toBe('http://localhost:47600/')
    expect(promptable('wss://192.168.1.2:4455')).toBe('https://192.168.1.2:4455')
  })
})
