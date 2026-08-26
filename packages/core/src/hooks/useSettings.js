import { useMemo } from 'react'

import { useStudio } from '../studio/context'
import { SettingsStore } from '../velcro/settings'

/**
 * This studio's settings, in the database that travels with it.
 *
 * Preferences rather than show state: what is here belongs to the person at the
 * board and is replicated to nobody, but it lives in IndexedDB alongside the
 * document and the image library so an export carries it to the next machine.
 */
export function useSettingsStore() {
  const { studio } = useStudio()

  return useMemo(() => new SettingsStore(studio.id ?? studio.name), [studio])
}
