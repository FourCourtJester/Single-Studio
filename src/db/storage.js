// Import core components
// ...

// Import our components
import store from 'db/store'
import { clearStudio, updateStudioFromStorage } from 'db/slices/studio'
import { clearSettings, updateSettingsFromStorage } from 'db/slices/settings'
import * as Storage from 'toolkits/storage'

export default function storage() {
  window.addEventListener('storage', (e) => {
    // The storage was cleared somehow
    // Reset all slices
    if (!e.key) {
      store.dispatch(clearStudio())
      store.dispatch(clearSettings())
      return true
    }

    // Check if keys either aren't ours or the values weren't updated
    if (!e.key.startsWith(Storage.namespace)) return true
    if (e.oldValue === e.newValue) return true

    const [, key, ...path] = e.key.split('.')

    // Update the appropriate slice
    switch (key) {
      // Settings
      case 'settings': {
        try {
          store.dispatch(updateSettingsFromStorage({ [path.join('.')]: JSON.parse(e.newValue) }))
        } catch (err) {
          console.warn(err)
          store.dispatch(updateSettingsFromStorage({ [path.join('.')]: null }))
        }
        break
      }

      // Default: Studio
      default: {
        try {
          store.dispatch(updateStudioFromStorage({ [path.join('.')]: JSON.parse(e.newValue) }))
        } catch (err) {
          console.warn(err)
          store.dispatch(updateStudioFromStorage({ [path.join('.')]: null }))
        }
        break
      }
    }

    return true
  })
}
