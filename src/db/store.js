// Import core components
import { configureStore } from '@reduxjs/toolkit'

// Import our components
import { reducer as studioReducer, clearStudio, updateStudioFromStorage } from 'db/slices/studio'
import * as Storage from 'toolkits/storage'

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

  const [, key, ...path] = e.key.split('.')

  // Update the appropriate slice
  switch (key) {
    // Default: Studio
    default: {
      try {
        store.dispatch(updateStudioFromStorage({ [path.join('.')]: JSON.parse(e.newValue) }))
      } catch (err) {
        store.dispatch(updateStudioFromStorage({ [path.join('.')]: null }))
        console.warn(err)
      }
      break
    }
  }

  return true
})

export default store
