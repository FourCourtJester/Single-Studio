// Import core components
import { createSlice } from '@reduxjs/toolkit'

// Import our components
import * as Utils from 'toolkits/utils'
import * as Storage from 'toolkits/storage'

const name = 'interactive'
const initialState = {
  components: {},
  selected: undefined,
}

function _remove(state, components) {
  Utils.getObjPaths(components, (path, _) => {
    Storage.remove([name, path])
  })
}

function _update(state, components, propagate = true) {
  Utils.getObjPaths(components, (path, val) => {
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
export const interactive = createSlice({
  name,
  initialState: getState(),
  reducers: {
    clear: () => initialState,
    updateComponent: (state, { payload }) => {
      const { parent, ...component } = payload

      if (parent) {
        if (parent === 'mortise') _update(state, { components: component })
      }
    },
    updateFromStorage: (state, action) => _update(state, action, false),
    updateSelected: (state, { payload: component }) => {
      if (component.id) _update(state, { selected: component })
      else {
        _remove(state, { selected: component })
        state.selected = undefined
      }
    },
  },
})

// Reducer functions
export const {
  clear: clearInteractive,
  updateComponent: updateInteractiveComponent,
  updateFromStorage: updateInteractiveFromStorage,
  updateSelected: updateInteractiveSelected,
} = interactive.actions

// Selector functions
export const selectInteractive = (state) => state.interactive.selected
export const selectComponent = (state, id) => (id === 'mortise' ? state.interactive.components : state.interactive.components[id])

export const { reducer } = interactive
