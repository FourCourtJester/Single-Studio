// Import core components
import { createSlice } from '@reduxjs/toolkit'

// Import our components
import * as Utils from 'toolkits/utils'
import * as Storage from 'toolkits/storage'

const name = 'settings'
const initialState = {}

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

// Settings Slice
export const settings = createSlice({
  name,
  initialState: getState(),
  reducers: {
    clear: () => initialState,
    update: (state, { payload: fields }) => _update(state, fields),
    updateFromStorage: (state, { payload: fields }) => _update(state, fields, false),
  },
})

// Reducer functions
export const { clear: clearSettings, update: updateSettings, updateFromStorage: updateSettingsFromStorage } = settings.actions

// Selector functions
export const selector = (state, path) => Utils.getObjValue(state[name], path)

export const { reducer } = settings
