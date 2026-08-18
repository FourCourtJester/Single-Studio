/**
 * The document title an operator asked for in the URL, if any.
 *
 * Hash routing puts a source's route after the `#`, so every source on a studio
 * shares one origin and one path -- and anything that names a page from its URL
 * sees them all as the same page. `?title=` sits in the real query string, before
 * the hash, which makes each source's URL distinct in the part such things read.
 *
 * The hash query is checked too, so `#/source/x?title=Y` works for anyone who
 * writes it that way. Reading is synchronous and does not touch React, so a caller
 * can apply it before the first paint rather than an effect later.
 */
export function titleFromUrl(href = typeof window === 'undefined' ? '' : window.location.href) {
  if (!href) return null

  try {
    const url = new URL(href, 'http://localhost')
    const search = url.searchParams.get('title')

    if (search) return search

    // Everything after the first `?` inside the hash.
    const hash = url.hash.indexOf('?')

    if (hash === -1) return null

    return new URLSearchParams(url.hash.slice(hash + 1)).get('title')
  } catch {
    return null
  }
}
