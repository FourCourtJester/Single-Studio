import { createVelcroHost } from '@single-studio/core/worker'

import { STUDIO_ID } from './config'
import { mutations } from './mutations'

// The SharedWorker that owns this studio's state. Keep React out of this file --
// it is a separate bundle from your UI.
createVelcroHost({ name: STUDIO_ID, mutations })
