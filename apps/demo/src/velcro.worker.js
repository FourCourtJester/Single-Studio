import { createVelcroHost } from '@single-studio/core/worker'

import { STUDIO_ID } from './config'
import { mutations } from './mutations'

// The SharedWorker entry. This is the whole plugin mechanism for state:
// the studio hands its own mutations to the host at startup, so there is no
// dynamic import of a conventional path and nothing is discovered by globbing.
//
// React is deliberately absent from this module -- it is a separate bundle.
createVelcroHost({ name: STUDIO_ID, mutations })
