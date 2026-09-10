// Everything that can change this studio's state, in one object. If it is not in
// here, it cannot be dispatched.
//
// The worker hands this to createVelcroHost, where it joins the built-ins --
// `{ ...builtins, ...yours }` -- so `mutate('set', ...)` and `mutate('demo:goal')`
// are the same call through the same registry. Nothing is discovered by scanning
// folders.
//
// Split by area as the show grows, one file per part of the broadcast.

import { show } from './show'

export const mutations = {
  ...show,
}
