import { useEffect } from 'react'

/**
 * Name the document.
 *
 * Worth doing for more than tidiness: an OBS custom browser dock takes its tab
 * label from the title, and `chrome://inspect` lists every browser source by it. A
 * studio with a dozen sources is much easier to debug when that list reads
 * "Scoreboard - Demo" rather than a dozen identical entries.
 */
export function usePageTitle(...parts) {
  const title = parts.filter(Boolean).join(' · ')

  useEffect(() => {
    if (!title) return undefined

    const previous = document.title

    document.title = title

    return () => {
      document.title = previous
    }
  }, [title])
}
