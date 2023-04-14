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
      // Studio code and array entry
      const code = Storage.get([name, 'code'])
      const entry = _find(state, component.parent)
      // Component properties for the array
      const { dependents, id, type } = component

      // Save the array information
      entry.dependents.push({ dependents, id, type })

      // Save the component seperately for easier access
      Utils.setObjValue(state, `${code}.${id}`, component)

      // Update Storage with new dependents
      Storage.set([name, code, 'dependents'], Utils.getObjValue(state, `${code}.dependents`))

      delete component.dependents

      // Update the component properties
      Storage.set([name, code, id], component)
    },
    updateComponent: (state, { payload: component }) => {
      // Studio code and component entry
      const code = Storage.get([name, 'code'])
      const entry = Utils.getObjValue(state, `${code}.${component.id}`)

      console.log(entry, component)

      // Save the paths
      Utils.getObjPaths(component, (path, val) => {
        console.log(entry, path, val)
        Utils.setObjValue(entry, path, val)
      })

      // Update Storage with the new component properties
      Storage.set([name, code, entry.id], entry)
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
export const selectComponent = (state, id) => Utils.getObjValue(state.interactive, `${Storage.get([name, 'code'])}.${id}`)
export const selectDependents = (state, id) => _find(state.interactive, id, { immutable: true })
export const selectInteractive = (state) => state.interactive.selected

export const { reducer } = interactive
