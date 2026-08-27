// OBS's events, in the shape a studio would have written.
//
// Field names come from obs-websocket's own protocol reference. The reshaping is
// small on purpose -- OBS is already close to readable -- and is mostly about two
// things: dropping the UUIDs nobody addresses anything by, and turning
// `outputActive` plus `outputState` into the one word a graphic reads.

/**
 * `outputState` is a string like `OBS_WEBSOCKET_OUTPUT_STARTING`, which is precise
 * and not something to put in a template. `outputActive` alone loses the difference
 * between starting and started, and a "LIVE" badge that lights up during the
 * handshake is on air before the stream is.
 */
const stateOf = (data) => {
  const raw = String(data?.outputState ?? '')
  const word = raw.replace('OBS_WEBSOCKET_OUTPUT_', '').toLowerCase()

  return {
    active: Boolean(data?.outputActive),
    state: word || (data?.outputActive ? 'started' : 'stopped'),
    // The two that matter for a badge: only `started` is genuinely on air.
    live: word === 'started',
    settling: word === 'starting' || word === 'stopping',
  }
}

export const EVENTS = {
  CurrentProgramSceneChanged: {
    emit: 'scene',
    category: 'scenes',
    shape: (data) => ({ name: data?.sceneName ?? null }),
  },
  CurrentPreviewSceneChanged: {
    emit: 'preview',
    category: 'scenes',
    shape: (data) => ({ name: data?.sceneName ?? null }),
  },
  SceneItemEnableStateChanged: {
    emit: 'sourceVisibility',
    category: 'sceneItems',
    shape: (data) => ({ scene: data?.sceneName ?? null, itemId: data?.sceneItemId ?? null, visible: Boolean(data?.sceneItemEnabled) }),
  },
  StreamStateChanged: {
    emit: 'stream',
    category: 'outputs',
    shape: stateOf,
  },
  RecordStateChanged: {
    emit: 'record',
    category: 'outputs',
    shape: (data) => ({ ...stateOf(data), path: data?.outputPath ?? null }),
  },
  InputMuteStateChanged: {
    emit: 'mute',
    category: 'inputs',
    shape: (data) => ({ input: data?.inputName ?? null, muted: Boolean(data?.inputMuted) }),
  },
  SceneTransitionStarted: {
    emit: 'transitionStarted',
    category: 'transitions',
    shape: (data) => ({ transition: data?.transitionName ?? null }),
  },
  SceneTransitionEnded: {
    emit: 'transitionEnded',
    category: 'transitions',
    shape: (data) => ({ transition: data?.transitionName ?? null }),
  },
  ExitStarted: {
    emit: 'exit',
    category: 'general',
    shape: () => ({}),
  },
}

/** The categories the wanted events live in, as one bitmask's worth of names. */
export const categoriesFor = (types = Object.keys(EVENTS)) => [...new Set(types.map((type) => EVENTS[type]?.category).filter(Boolean))]

/**
 * One OBS event, as the event a studio hears.
 *
 * Unknown types pass through under their own name with the payload untouched, so a
 * studio wanting something this table has not caught up with is not blocked on a
 * release.
 */
export function normalise(type, data) {
  const known = EVENTS[type]

  return {
    name: known?.emit ?? type,
    payload: { ...(known ? known.shape(data) : {}), raw: data },
  }
}
