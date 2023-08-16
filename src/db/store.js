// Import core components
import { configureStore } from '@reduxjs/toolkit'

// Import our components
import studioReducer from 'db/slices/studio'
import settingsReducer from 'db/slices/settings'

const initialState = {}
const store = configureStore({
  preloadedState: initialState,
  reducer: {
    settings: settingsReducer,
    studio: studioReducer,
  },
})

export const { dispatch } = store

export default store
