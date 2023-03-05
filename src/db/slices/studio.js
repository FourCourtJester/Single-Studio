// Import core components
import { createSlice } from '@reduxjs/toolkit'

// Import our components
import * as Utils from 'toolkits/utils'
import * as Storage from 'toolkits/storage'

const name = 'studio'
const initialState = {}

function _update(state, fields, propogate = true) {
  Utils.getObjPaths(fields, (path, val) => {
    Utils.setObjValue(state, path, val)
    if (propogate) Storage.set([name, path], val)
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
      paths.forEach((path) => {
        Utils.setObjValue(state, path, null)
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
export const { clear: clearStudio, reset: resetStudio, swap: swapStudio, update: updateStudio, updateFromStorage: updateStudioFromStorage } = studio.actions

// Selector functions
export const selector = (state, path) =>
  // console.log(state, path, Utils.getObjValue(state.studio, path))
  Utils.getObjValue(state.studio, path)

export const { reducer } = studio
