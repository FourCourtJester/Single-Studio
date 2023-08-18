// Import core components
import { createSlice } from '@reduxjs/toolkit'

// Import our components
import * as Utils from 'toolkits/utils'
import * as Storage from 'toolkits/storage'

const name = 'studio'
const initialState = {}
const undef = undefined

function _update(state, fields, propagate = true) {
  Utils.getObjPaths(fields, (path, val) => {
    Utils.setObjValue(state, path, val)
    if (propagate) Storage.set([name, path], val)
  })
}

function getState() {
  try {
    const persistentState = Storage.getAll(name) || {}
    return Utils.getObjValue(persistentState, name) || {}
  } catch (err) {
    console.error(err)
    return initialState
  }
}

// Studio Slice
export const studio = createSlice({
  name,
  initialState: getState(),
  reducers: {
    clear: () => initialState,
    reset: (state, { payload: paths }) => {
      // Attempt to reset each path
      paths.forEach((path) => {
        const val = Utils.getObjValue(state, path)
        const obj = typeof val === 'object' ? { ...val } : {}

        if (Object.keys(obj).length) {
          // If the path is an object with children
          // Reset each child instead
          Utils.getObjPaths(obj, (key) => {
            Utils.setObjValue(state, `${path}.${key}`, null)
          })

          Storage.removeObj([name, path], obj)
        } else {
          // The path is a simple type, just reset it
          Utils.setObjValue(state, path, null)

          Storage.remove([name, path])
        }
      })
    },
    remove: (state, { payload: paths }) => {
      // Attempt to remove each path
      paths.forEach((path) => {
        const parts = path.split('.')
        const key = parts.pop()
        const obj = Utils.getObjValue(state, parts.join('.'))

        // If Object, remove all children keys from Storage
        if (typeof obj[key] === 'object') {
          Utils.getObjPaths(obj[key], (childKey) => {
            Storage.remove([name, path, childKey])
          })
        }

        delete obj[key]
        Storage.remove([name, path])
      })
    },
    swap: (state, { payload: fields }) => {
      const mid = Math.ceil(fields.length / 2)
      const from = Object.entries(fields.slice(0, mid).reduce((obj, path) => ({ ...obj, [path]: Utils.getObjValue(state, path) }), {}))

      fields.slice(mid).forEach((path, i) => {
        const to = Utils.getObjValue(state, path)

        Utils.setObjValue(state, from[i][0], to)
        Storage.set([name, from[i][0]], to !== undefined ? to : null)

        Utils.setObjValue(state, path, from[i][1])
        Storage.set([name, path], from[i][1] !== undefined ? from[i][1] : null)
      })
    },
    update: (state, { payload: fields }) => _update(state, fields),
    updateFromStorage: (state, { payload: fields }) => _update(state, fields, false),
  },
})

// Reducer functions
export const {
  clear: clearStudio,
  remove: removeStudio,
  reset: resetStudio,
  swap: swapStudio,
  update: updateStudio,
  updateFromStorage: updateStudioFromStorage,
} = studio.actions

// Selector functions
export const selector = (state, path) => {
  const val = Utils.getObjValue(state[name], path)
  return typeof val === 'number' ? val : val || undef
}

// export const { reducer } = studio
export default studio.reducer
