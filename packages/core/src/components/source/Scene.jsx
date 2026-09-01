import { useMemo } from 'react'

import { useVelcroVars } from '../../hooks/useVelcroVars'
import { qualify } from '../../toolkits/address'
import { cx } from '../../toolkits/cx'

/** Where this component's values live. Not a prop: a studio never needs another. */
const NAMESPACE = 'variables'

/**
 * @typedef {object} SceneProps
 * @property {import("react").ReactNode} [children] - The graphic.
 * @property {Record<string, string>} [vars] - CSS custom property to value name, e.g. `{ "--accent": "home.color" }`.
 * @property {number|string} [width] - A fixed width. A number is pixels; a string is used as written.
 * @property {number|string} [height] - A fixed height. A number is pixels; a string is used as written.
 * @property {string} [className] - Added to the component's own classes.
 */
/**
 * The root of a graphic — one per OBS browser source. `vars` maps CSS custom
 * properties to values an operator controls, which is how a graphic follows input
 * the framework has no component for.
 *
 * `vars` maps CSS custom properties to values an operator controls, so a graphic
 * can be driven by anything a stylesheet can express -- a team colour, a bar width,
 * a corner radius -- rather than only the text and images the framework happens to
 * have components for:
 *
 *   <Scene vars={{ '--home-color': 'home.color' }}>
 *     <div style={{ background: 'var(--home-color, #0a3161)' }} />
 *
 * Names, not paths -- the same as every other component. It used to take
 * `variables.home.color` here while the component beside it took `home.color`,
 * which is one value written two ways on adjacent lines.
 *
 * A graphic needing a custom property from a toggle or a timer should call
 * `useVelcroVars` directly: the hook takes full paths, and that split is the
 * framework's rule rather than an exception made here. Components take names;
 * hooks take paths.
 *
 * A value holding nothing is left unset rather than blanked, so the fallback in
 * `var()` still applies.
 *
 * A scene fills its browser source, which is what you want on air -- OBS decides the
 * size and the graphic follows. `width` and `height` pin it instead, which is worth
 * having while building one: a 1920x1080 scene in a browser tab is what the source
 * will actually look like, rather than whatever shape the window happens to be.
 *
 *   <Scene width={1920} height={1080}>
 *
 * A class cannot do this. `h-full` and `h-[1080px]` have the same specificity, so
 * which one wins is decided by the order Tailwind emits them in rather than the
 * order they are written -- these set the style directly, which always wins.
 *
 * @example
 * export default function Scoreboard() {
 *   return (
 *     <Scene>
 *       <Variable name="home.name" fallback="Home" />
 *     </Scene>
 *   )
 * }
 *
 * @example
 * // A team colour driving anything the stylesheet can express
 * <Scene vars={{ '--home': 'home.color' }}>
 *   <div style={{ background: 'var(--home, #0a3161)' }} />
 * </Scene>
 *
 * @param {SceneProps & import("react").HTMLAttributes<HTMLElement>} props
 */
export function Scene({ children, className, vars, width, height, style, ...rest }) {
  // Rebuilt only when the map's contents change, not on every render -- an inline
  // object literal is a new object each time, and the hook subscribes off this.
  const signature = JSON.stringify(vars ?? {})
  const paths = useMemo(() => {
    const entries = Object.entries(JSON.parse(signature))

    return Object.fromEntries(entries.map(([property, name]) => [property, qualify({ names: name, namespace: NAMESPACE }).at(0)]).filter(([, path]) => path))
  }, [signature])

  const resolved = useVelcroVars(paths)

  // A bare number is pixels, because that is what anybody typing 1920 means. A
  // string is passed through, so `50vw` and `100%` work too.
  const size = (value) => (typeof value === 'number' ? `${value}px` : value)

  return (
    <div
      className={cx('ss-scene relative overflow-hidden', width === undefined && 'w-full', height === undefined && 'h-full', className)}
      // Dropped from the class list rather than layered over, so what is in the
      // element inspector is what is happening.
      style={{ ...resolved, ...(width === undefined ? {} : { width: size(width) }), ...(height === undefined ? {} : { height: size(height) }), ...style }}
      {...rest}
    >
      {children}
    </div>
  )
}
