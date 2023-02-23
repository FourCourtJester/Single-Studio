// Import core components
import { configureStore } from '@reduxjs/toolkit'

// Import our components
import { reducer as studioReducer, updateStudio } from 'db/slices/studio'
import * as Storage from 'toolkits/storage'

const initialState = {}
const store = configureStore({
  preloadedState: initialState,
  reducer: {
    studio: studioReducer,
  },
})

store.subscribe(() => Storage.set('redux', store.getState()))

window.addEventListener('storage', (e) => {
  if (e.oldValue === e.newValue) return true

  const { studio } = JSON.parse(e.newValue)

  store.dispatch(updateStudio(studio))

  return true
})

export default store
