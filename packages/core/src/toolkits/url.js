/** OBS reads this one off a browser source's URL to name the source. */
export const LAYER_NAME = 'layer-name'

/**
 * The name OBS was given for this page, if any.
 *
 * Hash routing puts a source's route after the `#`, so every source on a studio
 * shares one origin and one path -- and OBS, naming a browser source from its URL,
 * sees them all as the same page. That is where a scene full of `localhost`,
 * `localhost (2)`, `localhost (3)` comes from. `?layer-name=` sits in the real query
 * string, ahead of the hash, which is where OBS looks.
 *
 * The hash query is checked too, so `#/source/x?layer-name=Y` works for anyone who
 * writes it that way. Reading is synchronous and does not touch React, so a caller
 * can apply it before the first paint rather than in an effect afterwards.
 */
export function layerNameFromUrl(href = typeof window === 'undefined' ? '' : window.location.href) {
  if (!href) return null

  try {
    const url = new URL(href, 'http://localhost')
    const search = url.searchParams.get(LAYER_NAME)

    if (search) return search

    // Everything after the first `?` inside the hash.
    const hash = url.hash.indexOf('?')

    if (hash === -1) return null

    return new URLSearchParams(url.hash.slice(hash + 1)).get(LAYER_NAME)
  } catch {
    return null
  }
}
