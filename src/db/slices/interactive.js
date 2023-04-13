// Import core components
import { createSlice } from '@reduxjs/toolkit'

// Import our components
import * as Utils from 'toolkits/utils'
import * as Storage from 'toolkits/storage'

const name = 'interactive'
const initialState = {
  selected: {},
}

function _find(root, id, { immutable = false, recursed = false } = {}) {
  const code = Storage.get([name, 'code'])
  const dependents = recursed ? root : Utils.getObjValue(root, `${code}.dependents`) || []

  // Attach to base level
  if (!id) {
    if (immutable) return { dependents }

    if (!Utils.getObjValue(root, `${code}.dependents`)) Utils.setObjValue(root, `${code}.dependents`, [])
    return root[code]
  }

  // Find the parent branch
  for (let i = 0; i < dependents.length; i += 1) {
    const component = dependents[i]
    if (component.id === id) return component

    // Recuse down the tree
    if (component.dependents && component.dependents.length) {
      const child = _find(component.dependents, id, { immutable, recursed: true })
      if (child) return child
    }
  }

  // Recurse failed to find the component
  return false
}

function getState() {
  try {
    const persistentState = Storage.getAll(name) || {}
    return { ...initialState, ...(Utils.getObjValue(persistentState, name) || {}) }
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
    addComponent: (state, { payload: component }) => {
      const code = Storage.get([name, 'code'])
      const entry = _find(state, component.parent)

      entry.dependents.push(component)
      Storage.set([name, code, 'dependents'], Utils.getObjValue(state, `${code}.dependents`))
    },
    updateComponent: (state, { payload: component }) => {
      const code = Storage.get([name, 'code'])
      const entry = _find(state, component.id)

      Utils.getObjPaths(component, (path, val) => Utils.setObjValue(entry, path, val))
      Storage.set([name, code, 'dependents'], Utils.getObjValue(state, `${code}.dependents`))
    },
    updateFromStorage: (state, { payload: obj }) => {
      Utils.getObjPaths(obj, (key, val) => Utils.setObjValue(state, key, val))
    },
    updateSelected: (state, { payload: component }) => {
      if (component.id) state.selected = component
      else state.selected = {}
    },
  },
})

// Reducer functions
export const {
  clear: clearInteractive,
  addComponent: addInteractiveComponent,
  updateComponent: updateInteractiveComponent,
  updateFromStorage: updateInteractiveFromStorage,
  updateSelected: updateInteractiveSelected,
} = interactive.actions

// Selector functions
export const selectInteractive = (state) => state.interactive.selected
export const selectComponent = (state, id) => _find(state.interactive, id, { immutable: true })

export const { reducer } = interactive
