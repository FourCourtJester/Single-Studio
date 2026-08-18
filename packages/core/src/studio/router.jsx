import { createHashRouter, createRoutesFromElements, Route, RouterProvider } from 'react-router-dom'

import { useRelay } from '../hooks/useRelay'
import { ControlPage } from '../pages/Control'
import { NotFoundPage } from '../pages/NotFound'
import { SourcePage } from '../pages/Source'
import { StudioProvider } from './Provider'

// Routes, rebuilt around one repo per studio.
//
//   /               the control surface (runs as an OBS custom browser dock)
//   /source/:name   one graphic, added to OBS as a browser source
//
// The old `:code` segment is gone. A studio repo *is* one studio, so its
// identity is build configuration rather than a URL parameter -- which also
// means the framework never dynamically imports a user-supplied path.
//
// Hash routing stays: it is what lets a static GitHub Pages deploy serve deep
// links without a 404 rewrite rule.
export function createStudioRouter(studio) {
  return createHashRouter(
    createRoutesFromElements(
      <>
        <Route index element={<ControlPage />} />
        <Route path="source/:name" element={<SourcePage />} />
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
 */
export function StudioApp({ studio, fallback }) {
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
