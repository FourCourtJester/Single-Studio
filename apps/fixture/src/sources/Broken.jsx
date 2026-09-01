import { Scene } from '@single-studio/core/source'

// Deliberately throws. Used by the e2e to prove a crashed graphic paints nothing on
// air, and shows itself under ?debug.
export default function Broken() {
  const missing = null

  return <Scene>{missing.name.toUpperCase()}</Scene>
}
