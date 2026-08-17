import { useVelcroVars } from '../../hooks/useVelcroVars'
import { cx } from '../../toolkits/cx'

/**
 * Root of a graphic. One Scene per OBS browser source.
 *
 * `vars` maps CSS custom properties to paths, so an operator's input can drive
 * anything a stylesheet can express rather than only the text and images the
 * framework happens to have components for:
 *
 *   <Scene vars={{ '--home-color': 'variables.home.color' }}>
 *     <div style={{ background: 'var(--home-color, #0a3161)' }} />
 *
 * A path holding nothing is left unset rather than blanked, so the fallback in
 * `var()` still applies.
 */
export function Scene({ children, className, vars, style, ...rest }) {
  const resolved = useVelcroVars(vars)

  return (
    <div className={cx('ss-scene relative h-full w-full overflow-hidden', className)} style={{ ...resolved, ...style }} {...rest}>
      {children}
    </div>
  )
}
