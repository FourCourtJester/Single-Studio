// Import core components
import { configureStore } from '@reduxjs/toolkit'

// Import our components
import { reducer as studioReducer, clearStudio, updateStudioFromStorage } from 'db/slices/studio'
import * as Storage from 'toolkits/storage'
import * as Utils from 'toolkits/utils'

const initialState = {}
const store = configureStore({
  preloadedState: initialState,
  reducer: {
    studio: studioReducer,
  },
})

window.addEventListener('storage', (e) => {
  // The storage was cleared somehow
  // Reset all slices
  if (!e.key) {
    store.dispatch(clearStudio())
    return true
  }

  // Check if keys either aren't ours or the values weren't updated
  if (!e.key.startsWith(Storage.namespace)) return true
  if (e.oldValue === e.newValue) return true

  try {
    const [, key, ...path] = e.key.split('.')

    // Update the appropriate slice
    switch (key) {
      // Default: Studio
      default: {
        store.dispatch(updateStudioFromStorage({ [path.join('.')]: JSON.parse(e.newValue) }))
        break
      }
    }
  } catch (err) {
    console.error(err)
  }

  return true
})

export default store
