import { createHashRouter, createRoutesFromElements, Route, RouterProvider } from 'react-router-dom'

import { useRelay } from '../hooks/useRelay'
import { ControlPage } from '../pages/Control'
import { NotFoundPage } from '../pages/NotFound'
import { SourcePage } from '../pages/Source'
import { StudioProvider } from './Provider'

// Routes, rebuilt around one repo per studio.
//
//   /               the control surface (runs as an OBS custom browser dock)
//   /source/*       one graphic, added to OBS as a browser source
//
// The old `:code` segment is gone. A studio repo *is* one studio, so its
// identity is build configuration rather than a URL parameter -- which also
// means the framework never dynamically imports a user-supplied path.
//
// A splat rather than `:name`, so a source key can carry slashes and a studio can
// group its graphics the way it thinks about them: `lower-thirds/single`,
// `lower-thirds/double`, `game/scoreboard`. Nothing is looked up by path -- the key
// still has to be a registered entry in `sources` -- so this widens what a studio
// may call a graphic, not what a URL can reach.
//
// Hash routing stays: it is what lets a static GitHub Pages deploy serve deep
// links without a 404 rewrite rule.
/**
 * @param {object} studio - a studio definition from `defineStudio`
 * @returns {ReturnType<typeof createHashRouter>} the router to hand `RouterProvider`
 *
 * Annotated rather than inferred. The return type is react-router's `Router`, which
 * lives at a pnpm-hashed path inside node_modules -- TypeScript can infer it but
 * cannot *name* it portably, so the emitted declaration would either fail or bake in
 * a path that is true of this machine and nowhere else.
 */
export function createStudioRouter(studio) {
  return createHashRouter(
    createRoutesFromElements(
      <>
        <Route index element={<ControlPage />} />
        <Route path="source/*" element={<SourcePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </>,
    ),
    { basename: studio.basename },
  )
}

/**
 * Mount a whole studio. This is all a studio's main.jsx needs to call.
 *
 * The provider sits outside the router so the Velcro client is created once for
 * the page rather than per navigation.
 *
 * @param {object} props
 * @param {ReturnType<typeof import('./defineStudio').defineStudio>} props.studio - from `defineStudio`
 * @param {import('react').ReactNode} [props.fallback] - shown while a page's chunk loads
 */
export function Studio({ studio, fallback }) {
  return (
    <StudioProvider studio={studio} fallback={fallback}>
      <Room />
      <RouterProvider router={createStudioRouter(studio)} />
    </StudioProvider>
  )
}

/**
 * Joins whatever room this machine was pointed at.
 *
 * Rendered above the router rather than on the board, because it is the *machine*
 * that joins a room, not a page: a graphic opened on its own must reach the show
 * as surely as a dock does, and on the host's machine they all share one worker
 * anyway. Renders nothing.
 */
function Room() {
  useRelay()

  return null
}
