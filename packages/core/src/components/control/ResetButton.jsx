import { useVelcroMutate } from '../../hooks/useVelcroMutate'
import { qualify } from '../../toolkits/address'
import { cx } from '../../toolkits/cx'
import { Confirm } from './Confirm'

/** Where this component's values live. Not a prop: a studio never needs another. */
const NAMESPACE = 'variables'

/**
 * @typedef {object} ResetButtonProps
 * @property {string[]} [names] - Cleared back to each source's own fallback.
 * @property {string[]} [paths] - Full paths, for clearing `toggles` or `timers` in the same press.
 * @property {string} [label] - Names what gets cleared: the button reads "Reset `<label>`". Defaults to `"Reset"`.
 * @property {boolean} [confirm] - Ask before clearing. Defaults to `true`; pass `confirm={false}` for a button that fires on one press.
 * @property {import("react").ReactNode} [children] - Replaces the generated "Reset `<label>`" text.
 * @property {string} [className] - Added to the component's own classes.
 */
/**
 * Clear a set of values back to each source's own fallback. It unsets rather than
 * writing empties, so a graphic falls back rather than going blank. Asks first.
 *
 * Uses `unset` rather than writing empty strings, so the keys are removed and each
 * source falls back to its own default. Writing '' would leave the paths present
 * and holding blanks, which looks the same in the board and different on air.
 *
 * `label` names what gets cleared, and the button says "Reset `<label>`" -- so
 * `label="draft"` reads "Reset draft" rather than a red button saying "draft",
 * which told an operator the colour was dangerous but not what it would do.
 *
 * Takes `names` the way every other component does. Those name values under
 * `variables`, which is where a studio's own values live; `paths` is the way to
 * reach anything else in the same press -- clearing a toggle and the value it was
 * showing together, say.
 *
 * **It asks by default.** The first press arms the button and says so, the second
 * does it, and a few seconds of silence disarms it. It asks inside the page rather
 * than through `window.confirm`, which is not a style choice -- see <Confirm>.
 *
 * Asking was a prop you had to remember, and a guard nobody opts into is not a
 * guard. The failure it exists for is one mis-aimed click wiping a scoreboard on
 * air, in front of an audience, with no undo -- which is worth the second click
 * every time, and which happened before this default changed.
 *
 * `confirm={false}` gives back the single press, for a button whose worst outcome
 * is small and whose speed matters more.
 *
 * @example
 * <ResetButton label="scores" names={['home.score', 'away.score']} />
 *
 * @example
 * // One press, for something trivial to put back
 * <ResetButton label="the note" names={['lowerthird.note']} confirm={false} />
 *
 * @param {ResetButtonProps & import("react").ButtonHTMLAttributes<HTMLElement>} props
 */
export function ResetButton({ names = [], paths = [], label = 'Reset', confirm = true, className, children, ...rest }) {
  const mutate = useVelcroMutate()
  const targets = qualify({ names, paths, namespace: NAMESPACE })

  // A bare `label="Reset"` is the noun and the verb at once; anything else is just
  // the noun and needs the verb in front of it.
  const text = String(label).trim().toLowerCase() === 'reset' ? 'Reset' : `Reset ${label}`

  const clear = () => mutate('unset', targets)

  /**
   * Asking used to be `window.confirm`, which is the one way of asking that does not
   * work where this board actually runs.
   *
   * An OBS custom browser dock is a CEF surface with no chrome to draw a native
   * dialog into: depending on the build the prompt either never appears or appears
   * somewhere the operator is not looking, and `confirm()` returns false either way.
   * So the guard that existed to make a destructive button safer was instead making
   * it silently do nothing -- the operator presses Reset, no dialog, no reset, and
   * nothing to say why. <Confirm> asks inside the page, which is the only version
   * that is true everywhere the board runs.
   */
  if (confirm) {
    return (
      <Confirm className={cx('ss-reset', className)} label={text} onConfirm={clear} title={text} {...rest}>
        {children}
      </Confirm>
    )
  }

  return (
    <button
      type="button"
      onClick={clear}
      title={text}
      className={cx('ss-reset rounded-md bg-rose-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-500', className)}
      {...rest}
    >
      {children ?? text}
    </button>
  )
}
