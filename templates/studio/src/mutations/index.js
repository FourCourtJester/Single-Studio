// Everything that can change this studio's state, in one object.
//
// Split it by area as the show grows -- one file per part of the broadcast, merged
// here. If it is not in this object, it cannot be dispatched.
import { custom } from './custom'
import { show } from './show'

export const mutations = {
  ...show,
  ...custom,
}
