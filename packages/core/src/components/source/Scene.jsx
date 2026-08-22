import { useMemo } from 'react'

import { useVelcroVars } from '../../hooks/useVelcroVars'
import { qualify } from '../../toolkits/address'
import { cx } from '../../toolkits/cx'

/**
 * Root of a graphic. One Scene per OBS browser source.
 *
 * `vars` maps CSS custom properties to values an operator controls, so a graphic
 * can be driven by anything a stylesheet can express -- a team colour, a bar width,
 * a corner radius -- rather than only the text and images the framework happens to
 * have components for:
 *
 *   <Scene vars={{ '--home-color': 'home.color' }}>
 *     <div style={{ background: 'var(--home-color, #0a3161)' }} />
 *
 * Names, not paths, and `namespace` picks where they live -- the same as every
 * other component. It used to take `variables.home.color` here while the component
 * beside it took `home.color`, which is one value written two ways on adjacent
 * lines.
 *
 * A graphic needing custom properties from more than one namespace at once should
 * call `useVelcroVars` directly: the hook takes full paths, and that split is the
 * framework's rule rather than an exception made here. Components take names;
 * hooks take paths.
 *
 * A value holding nothing is left unset rather than blanked, so the fallback in
 * `var()` still applies.
 */
export function Scene({ children, className, vars, namespace = 'variables', style, ...rest }) {
  // Rebuilt only when the map's contents change, not on every render -- an inline
  // object literal is a new object each time, and the hook subscribes off this.
  const signature = JSON.stringify(vars ?? {})
  const paths = useMemo(() => {
    const entries = Object.entries(JSON.parse(signature))

    return Object.fromEntries(entries.map(([property, name]) => [property, qualify({ names: name, namespace }).at(0)]).filter(([, path]) => path))
  }, [signature, namespace])

  const resolved = useVelcroVars(paths)

  return (
    <div className={cx('ss-scene relative h-full w-full overflow-hidden', className)} style={{ ...resolved, ...style }} {...rest}>
      {children}
    </div>
  )
}
