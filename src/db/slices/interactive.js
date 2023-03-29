// Import core components
import { createSlice } from '@reduxjs/toolkit'

// Import our components
import * as Utils from 'toolkits/utils'
import * as Storage from 'toolkits/storage'

const name = 'interactive'
const initialState = {
  components: [],
  selected: null,
}

function _find(components, id) {
  if (!id) return { dependents: components }

  for (let i = 0; i < components.length; i += 1) {
    if (components[i].id === id) return components[i]
    if (components[i].dependents && components[i].dependents.length) {
      const component = _find(components[i].dependents, id)
      if (component) return component
    }
  }
}

function _remove(state, components) {
  Utils.getObjPaths(components, (path, _) => {
    Storage.remove([name, path])
  })
}

function _update(state, components, propagate = true) {
  return false
  // Utils.getObjPaths(components, (path, val) => {
  //   Utils.setObjValue(state, path, val)
  //   if (propagate) Storage.set([name, path], val)
  // })
}

function getState() {
  try {
    const persistentState = Storage.getAll(name) || {}
    return Utils.getObjValue(persistentState, name) || initialState
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
      const _component = _find(state.components, component.parent)

      _component.dependents.push(component)
      Storage.set([name, 'components'], state.components)
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
export const selectComponent = (state, id) => _find(state.interactive.components, id)

export const { reducer } = interactive
