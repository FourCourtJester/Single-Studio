// Import core components
import { createSlice as cs } from '@reduxjs/toolkit'

// Import our components
import VelcroUtils from 'workers/velcro/utils'

const defaultReducers = {
  decrement(state, action) {
    VelcroUtils.math(state, VelcroUtils.prepare(action.payload), -1)
  },
  increment(state, action) {
    VelcroUtils.math(state, VelcroUtils.prepare(action.payload))
  },
  swap(state, action) {
    VelcroUtils.swap(state, action.payload)
  },
  update(state, action) {
    VelcroUtils.update(state, VelcroUtils.prepare(action.payload))
  },
}

export default function createSlice(name = 'idb', initialState = {}, extraReducers = {}) {
  return cs({
    name,
    initialState,
    reducers: { ...defaultReducers, ...extraReducers },
  })
}
