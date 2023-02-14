// Import core components
import { createSlice } from '@reduxjs/toolkit'

// Import our components
import * as Utils from 'toolkits/utils'
import * as Storage from 'toolkits/storage'

const name = 'studio'
const initialState = {
  variables: {},
  toggles: {},
  _timers: {},
  timers: {},
}

function getState() {
  try {
    const persistentState = Utils.getObjValue(Storage.get(`redux`), name) || {}

    return persistentState

    // return Object.entries(Utils.getObjPaths(persistentState)).reduce((obj, [key, val]) => {
    //   Utils.setObjValue(obj, key, val)
    //   return obj
    // }, persistentState)
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
    swap: (state, { payload: fields }) => {
      const mid = Math.ceil(fields.length / 2)
      const to = Object.entries(fields.slice(0, mid).reduce((obj, path) => ({ ...obj, [path]: Utils.getObjValue(state, path) }), {}))
      const from = Object.entries(fields.slice(mid).reduce((obj, path) => ({ ...obj, [path]: Utils.getObjValue(state, path) }), {}))

      to.forEach(([path, val], i) => {
        const [fPath, fVal] = from[i]
        Utils.setObjValue(state, fPath, val)
        Utils.setObjValue(state, path, fVal)
      })
    },
    update: (state, { payload: fields }) => {
      Utils.getObjPaths(fields, (path, val) => {
        Utils.setObjValue(state, path, val)
      })
    },
  },
})

// Reducer functions
export const { swap: swapStudio, update: updateStudio } = studio.actions

// Selector functions
export const selector = (state, path) =>
  // console.log(state, path, Utils.getObjValue(state.studio, path))
  Utils.getObjValue(state.studio, path)

export default studio.reducer
