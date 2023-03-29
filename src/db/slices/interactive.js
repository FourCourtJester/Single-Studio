// Import core components
import { createSlice } from '@reduxjs/toolkit'

// Import our components
import * as Utils from 'toolkits/utils'
import * as Storage from 'toolkits/storage'

const name = 'interactive'
const initialState = {
  selected: null,
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

function _remove(state, components) {
  Utils.getObjPaths(components, (path, _) => {
    Storage.remove([name, path])
  })
}

function _update(state, component, propagate = true) {
  const code = Storage.get([name, 'code'])
  const entry = _find(state, component.parent, { immutable: false })

  entry.dependents.push(component)
  if (propagate) Storage.set([name, code, 'dependents'], Utils.getObjValue(state, `${code}.dependents`))
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
    updateComponent: (state, { payload: component }) => {
      _update(state, component)
    },
    updateFromStorage: (state, action) => console.log('updateFromStorage'), // _update(state, action, false),
    updateSelected: (state, { payload: component }) => {
      if (component.id) {
        state.selected = component
        Storage.set([name, 'selected'], state.selected)
      } else {
        state.selected = null
        Storage.remove([name, 'selected'])
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
export const selectComponent = (state, id) => _find(state.interactive, id, { immutable: true })

export const { reducer } = interactive
