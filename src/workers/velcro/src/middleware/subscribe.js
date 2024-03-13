import { createAction } from '@reduxjs/toolkit'

import * as Utils from 'toolkits/utils'
import VelcroUtils from 'workers/velcro/utils'

const SUBSCRIBE = 'idb/subscribe'
const UNSUBSCRIBE = 'idb/unsubscribe'

const subscribe = createAction(SUBSCRIBE)
const unsubscribe = createAction(UNSUBSCRIBE)

export const actions = {
  subscribe,
  unsubscribe,
}

export default function subscribeMiddleware({ getState }) {
  const radio = {}

  return (next) => (action) => {
    switch (action.type) {
      case SUBSCRIBE: {
        const path = action.payload
        const state = getState()

        if (radio?.[path]) {
          radio[path].listeners += 1
          radio[path].channel.postMessage(Utils.getObjValue(state.idb, path))
          break
        }

        radio[path] = { channel: new BroadcastChannel(VelcroUtils.channelName(path)), listener: 1 }
        radio[path].channel.postMessage(Utils.getObjValue(state.idb, path))
        break
      }

      case UNSUBSCRIBE: {
        const path = action.payload

        if (!radio?.[path]) break

        radio[path].listeners -= 1

        if (radio[path].listeners - 1 <= 0) {
          radio[path].channel.close()
          delete radio[path]
        }

        break
      }

      default: {
        const prevState = getState()
        const result = next(action)
        const nextState = getState()

        const entries = VelcroUtils.diff(Object.keys(radio), prevState.idb, nextState.idb)

        entries.forEach(([path, val]) => {
          radio[path].channel.postMessage(val)
        })

        return result
      }
    }
  }
}
