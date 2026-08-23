// Everything that can change this studio's state, in one object.
//
// The worker hands this to createVelcroHost, where it joins the built-ins --
// `{ ...builtins, ...yours }` -- so `mutate('set', ...)` and `mutate('my:reset')`
// are the same call through the same registry. Nothing is discovered by scanning
// folders: if it is not in here, it does not exist.
//
// Split by area as the show grows -- one file per part of the broadcast, merged
// here. It stays one object either way, and this file is the list of what your
// studio can do.

import { custom } from './custom'
import { show } from './show'

export const mutations = {
  ...show,
  ...custom,
}
