// Import core components
import { createSlice } from '@reduxjs/toolkit'

// Import our components
// import * as Utils from 'toolkits/utils'
// import * as Storage from 'toolkits/storage'

const name = 'interactive'
const initialState = {
  selected: undefined,
}

// Studio Slice
export const interactive = createSlice({
  name,
  initialState,
  reducers: {
    update: (state, action) => {
      state.selected = action.payload
    },
  },
})

// Reducer functions
export const { update: updateInteractive } = interactive.actions

// Selector functions
export const selectInteractive = (state) => state.interactive.selected

export default interactive.reducer
