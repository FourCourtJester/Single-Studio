import { describe, expect, it } from 'vitest'

import { categoriesFor, normalise } from '../src/events'

describe('scenes', () => {
  it('gives a graphic the name and nothing it will not use', () => {
    expect(normalise('CurrentProgramSceneChanged', { sceneName: 'Match', sceneUuid: 'abc' }).payload).toMatchObject({ name: 'Match' })
    expect(normalise('CurrentProgramSceneChanged', { sceneName: 'Match' }).name).toBe('scene')
  })

  it('keeps preview separate from program', () => {
    // In studio mode these differ, and a graphic reacting to preview would be
    // reacting to what the operator is lining up rather than what is on air.
    expect(normalise('CurrentPreviewSceneChanged', { sceneName: 'Next' }).name).toBe('preview')
  })
})

describe('stream and record state', () => {
  it('separates going live from being live', () => {
    // `outputActive` is true during the handshake, so a badge keyed on it alone
    // lights up before the stream is actually up.
    const starting = normalise('StreamStateChanged', { outputActive: true, outputState: 'OBS_WEBSOCKET_OUTPUT_STARTING' }).payload

    expect(starting).toMatchObject({ active: true, state: 'starting', live: false, settling: true })

    const started = normalise('StreamStateChanged', { outputActive: true, outputState: 'OBS_WEBSOCKET_OUTPUT_STARTED' }).payload

    expect(started).toMatchObject({ state: 'started', live: true, settling: false })
  })

  it('reads stopping as not live and not yet stopped', () => {
    const stopping = normalise('StreamStateChanged', { outputActive: false, outputState: 'OBS_WEBSOCKET_OUTPUT_STOPPING' }).payload

    expect(stopping).toMatchObject({ live: false, settling: true, state: 'stopping' })
  })

  it('falls back to active when OBS sends no state word', () => {
    expect(normalise('StreamStateChanged', { outputActive: true }).payload.state).toBe('started')
    expect(normalise('StreamStateChanged', { outputActive: false }).payload.state).toBe('stopped')
  })

  it('carries the file a recording was written to', () => {
    const { name, payload } = normalise('RecordStateChanged', {
      outputActive: false,
      outputState: 'OBS_WEBSOCKET_OUTPUT_STOPPED',
      outputPath: 'C:/recordings/show.mkv',
    })

    expect(name).toBe('record')
    expect(payload).toMatchObject({ live: false, path: 'C:/recordings/show.mkv' })
  })
})

describe('sources and inputs', () => {
  it('names the scene, the item and whether it shows', () => {
    const { name, payload } = normalise('SceneItemEnableStateChanged', { sceneName: 'Match', sceneItemId: 7, sceneItemEnabled: true })

    expect(name).toBe('sourceVisibility')
    expect(payload).toMatchObject({ scene: 'Match', itemId: 7, visible: true })
  })

  it('reads a mute as a boolean rather than as OBS spells it', () => {
    expect(normalise('InputMuteStateChanged', { inputName: 'Mic', inputMuted: true }).payload).toMatchObject({ input: 'Mic', muted: true })
  })
})

describe('anything else', () => {
  it('passes through under its own name, payload untouched', () => {
    const data = { vendorName: 'some-plugin', eventData: {} }
    const { name, payload } = normalise('VendorEvent', data)

    expect(name).toBe('VendorEvent')
    expect(payload.raw).toBe(data)
  })

  it('carries raw on the known ones too, so a missing field is never a blocker', () => {
    const data = { sceneName: 'Match', sceneUuid: 'abc' }

    expect(normalise('CurrentProgramSceneChanged', data).payload.raw).toBe(data)
  })
})

describe('categories', () => {
  it('are derived from the events asked for, not listed twice', () => {
    // The same table drives the events and the subscription mask, so they cannot
    // disagree -- subscribing to a category the wanted event does not live in is an
    // event that silently never arrives.
    expect(categoriesFor(['CurrentProgramSceneChanged'])).toEqual(['scenes'])
    expect(categoriesFor(['StreamStateChanged', 'RecordStateChanged'])).toEqual(['outputs'])
  })

  it('cover everything the plugin knows about', () => {
    expect(categoriesFor()).toEqual(expect.arrayContaining(['scenes', 'sceneItems', 'outputs', 'inputs', 'transitions', 'general']))
  })
})
