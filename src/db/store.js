// Import core components
import { configureStore } from '@reduxjs/toolkit'

// Import our components
import studioReducer from 'db/slices/studio'
import * as Storage from 'toolkits/storage'

const initialState = {}
const store = configureStore({
  preloadedState: initialState,
  reducer: {
    studio: studioReducer,
  },
})

store.subscribe(() => Storage.set('redux', store.getState()))

export default store
