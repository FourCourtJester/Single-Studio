// Import core components
import { configureStore } from '@reduxjs/toolkit'

// Import our components
import studioReducer from 'db/slices/studio'
import settingsReducer from 'db/slices/settings'

const initialState = {}
const defaultReducers = {
  settings: settingsReducer,
  studio: studioReducer,
}

const store = configureStore({
  preloadedState: initialState,
  reducer: defaultReducers,
})

export const { dispatch } = store

export const reducers = defaultReducers

export default store
