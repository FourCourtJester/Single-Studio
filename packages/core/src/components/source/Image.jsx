import { useEffect, useState } from 'react'

import { useVelcroState } from '../../hooks/useVelcroValue'
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
 * Two loads have to line up here and they are deliberately named apart:
 * `hydrated` is the store telling us what the value is, `painted` is the browser
 * telling us the file arrived. Nothing renders until both are true, so a graphic
 * never animates in around a half-fetched image, and a source rebuilt mid-show
 * never requests a URL built from an empty value and 404s onto the fallback.
 *
 * A failed load falls back rather than showing a broken-image glyph over the
 * stream -- a missing logo should read as "no logo", not as a bug.
 */
export function Image({ name, src, slug = false, fallback, alt = '', className, namespace = 'variables', ...rest }) {
  const { value, loaded: hydrated } = useVelcroState(name ? `${namespace}.${name}` : undefined)
  const [current, setCurrent] = useState(null)
  const [painted, setPainted] = useState(false)

  useEffect(() => {
    if (!src || !hydrated) return

    const resolved = String(src).replace(/:value:/g, slug ? slugify(value) : String(value ?? ''))

    setCurrent((previous) => {
      if (previous !== resolved) setPainted(false)
      return resolved
    })
  }, [hydrated, slug, src, value])

  const onError = () => {
    // Warn rather than fail silently: a wrong path is a studio bug worth seeing in
    // the console, even though the graphic degrades quietly on screen.
    console.warn(`[single-studio] image did not load: ${current}`)

    if (fallback && current !== fallback) {
      setCurrent(fallback)
      return
    }

    setPainted(false)
  }

  if (!hydrated || !current) return null

  return (
    <Transition trigger={painted} className={cx('ss-image', className)} {...rest}>
      <img src={current} alt={alt} onLoad={() => setPainted(true)} onError={onError} className="max-h-full max-w-full object-contain" />
    </Transition>
  )
}
