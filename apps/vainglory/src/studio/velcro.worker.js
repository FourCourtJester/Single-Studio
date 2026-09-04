import { createVelcroHost } from '@single-studio/core/worker'
import { connectSupabase } from '@single-studio/provider-supabase'

import { STUDIO_ID } from './config'
import { mutations } from '../mutations'

// The worker that owns this studio's state, shared by every tab. No React in here.

// Nothing connects until somebody pastes an invite link, so a one-machine show
// costs nothing -- but leaving this in is what lets a second operator join without
// a rebuild.
const connect = (context) => {
  if (!/^https?:/.test(context.url)) throw new Error(`This studio only knows how to reach a Supabase project, and ${context.url} is not one.`)

  return connectSupabase(context)
}

createVelcroHost({ name: STUDIO_ID, mutations, sync: { connect } })
