// Import core components
import { combineReducers } from '@reduxjs/toolkit'

// Import our components
import store, { reducers as globalReducers } from 'db/store'
import globalStorage from 'db/storage'
import { useEffectOnce } from './useEffectOnce'

function _noop() {
  return false
}

export const useRedux = (props) => {
  const { reducers = {}, storage = _noop } = props || {}

  useEffectOnce(() => {
    store.replaceReducer(
      combineReducers({
        ...globalReducers,
        ...reducers,
      })
    )

    globalStorage()
    storage()
  })
}
