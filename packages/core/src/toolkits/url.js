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

/**
 * Whether this page was asked to show its own errors.
 *
 * `?debug` on a graphic, which is a thing an author types while building one and a
 * thing OBS never has -- the URL the Browser sources list hands over does not carry
 * it. So the same build shows a crash on a desk and shows nothing on air, decided
 * by the address rather than by how it was compiled.
 *
 * Deliberately not `import.meta.env.DEV`. The framework is a library: that value is
 * resolved when *core* is built, not when a studio is, so it would say the same
 * thing in `npm run dev` as it does on air.
 */
export function debugFromUrl(href = typeof window === 'undefined' ? '' : window.location.href) {
  if (!href) return false

  try {
    const url = new URL(href, 'http://localhost')

    if (url.searchParams.has('debug')) return true

    const hash = url.hash.indexOf('?')

    return hash !== -1 && new URLSearchParams(url.hash.slice(hash + 1)).has('debug')
  } catch {
    return false
  }
}
