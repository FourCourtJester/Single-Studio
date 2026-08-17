import { useEffect, useState } from 'react'

import { useVelcroValue } from '../../hooks/useVelcroValue'
import { cx } from '../../toolkits/cx'
import { slugify } from '../../toolkits/slug'
import { Transition } from '../common/Transition'

/**
 * An image chosen by a value the operator controls.
 *
 * The `src` is a template containing `:value:`, substituted with the path's
 * current value -- so a team name drives a logo without anyone maintaining a
 * lookup table:
 *
 *   <Image name="home.name" src="/logos/:value:.png" slug />
 *
 * `slug` normalises the value first ("Boise State" -> "boise-state"), which is
 * what makes operator free-text usable in a filename.
 *
 * Two behaviours matter on air. The transition triggers on *load*, not on the
 * value changing, so a graphic never animates in around a half-fetched image. And
 * a failed load falls back rather than showing a broken-image glyph over the
 * stream -- a missing logo should read as "no logo", not as a bug.
 */
export function Image({ name, src, slug = false, fallback, alt = '', className, namespace = 'variables', ...rest }) {
  const value = useVelcroValue(name ? `${namespace}.${name}` : undefined)
  const [current, setCurrent] = useState(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!src) return

    const resolved = String(src).replace(/:value:/g, slug ? slugify(value) : String(value ?? ''))

    setCurrent((previous) => {
      if (previous !== resolved) setLoaded(false)
      return resolved
    })
  }, [slug, src, value])

  const onError = () => {
    // Warn rather than fail silently: a wrong path is a studio bug worth seeing in
    // the worker console, even though the graphic degrades quietly on screen.
    console.warn(`[single-studio] image did not load: ${current}`)

    if (fallback && current !== fallback) {
      setCurrent(fallback)
      return
    }

    setLoaded(false)
  }

  if (!current) return null

  return (
    <Transition trigger={loaded} className={cx('ss-image', className)} {...rest}>
      <img src={current} alt={alt} onLoad={() => setLoaded(true)} onError={onError} className="max-h-full max-w-full object-contain" />
    </Transition>
  )
}
