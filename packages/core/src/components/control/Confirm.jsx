import { useEffect, useRef, useState } from 'react'

import { cx } from '../../toolkits/cx'

/**
 * A destructive button that asks first, without a dialog.
 *
 * One click arms it and it says what it is about to do; a second click does it. A
 * few seconds of silence disarms it, so a board left alone never sits with a live
 * "wipe the show" under the cursor.
 *
 * **Not `window.confirm`.** The board's main home is an OBS custom browser dock,
 * and a dock is a CEF surface with no chrome to draw a native dialog into --
 * depending on the build, a `confirm()` there either never appears or appears
 * somewhere the operator is not looking. Either way the truthful reading of the
 * return value is "they said no", so the safest-looking guard in the codebase would
 * be the one that quietly makes the button stop working. Asking inside the page is
 * the only version that is true everywhere the board runs.
 *
 * It is also the better interaction. The question is asked where the answer is
 * given, the second click lands in the same place as the first, and there is no
 * modal to focus-trap or dismiss mid-show.
 */
const ARMED = 4000

/**
 * @typedef {object} ConfirmProps
 * @property {() => void} onConfirm - Called on the second click.
 * @property {string} [label] - What the button says when idle.
 * @property {string} [ask] - What it says once armed. Defaults to `"Click to confirm"`.
 * @property {'danger'|'quiet'} [tone] - Defaults to `"danger"`.
 * @property {boolean} [disabled] - Nothing happens on click.
 * @property {import("react").ReactNode} [children] - Replaces `label` when idle.
 * @property {string} [className] - Added to the component's own classes.
 */
/**
 * What an armed button says, and it is the same everywhere on purpose.
 *
 * It used to repeat the action -- "Remove all 17? Click again" -- which made the
 * widest button on the screen the one nobody wants to be looking at, and pushed
 * layouts around at the moment an operator is deciding something. The label already
 * said what it does and is still sitting under the cursor; the armed state only has
 * to say that a second click is what finishes it.
 */
const ASK = 'Click to confirm'

/**
 * @param {ConfirmProps & import("react").ButtonHTMLAttributes<HTMLElement>} props
 */
export function Confirm({ onConfirm, label, ask = ASK, tone = 'danger', disabled, className, children, ...rest }) {
  const [armed, setArmed] = useState(false)
  const timer = useRef(null)

  // Cleared on unmount as well as on re-arm. A dialog closed while a button is
  // armed would otherwise leave a timer holding a setter for a component nobody is
  // rendering.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  const disarm = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    setArmed(false)
  }

  const click = () => {
    if (!armed) {
      setArmed(true)
      timer.current = setTimeout(disarm, ARMED)
      return
    }

    disarm()
    onConfirm?.()
  }

  const looks =
    tone === 'quiet'
      ? 'border border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500 hover:text-slate-100'
      : 'border border-rose-500/50 bg-rose-500/10 text-rose-300 hover:border-rose-400 hover:text-rose-200'

  return (
    <button
      type="button"
      onClick={click}
      onBlur={disarm}
      disabled={disabled}
      data-armed={armed ? '' : undefined}
      className={cx(
        'ss-confirm rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        armed ? 'border-amber-400 bg-amber-500/15 text-amber-200' : looks,
        className,
      )}
      {...rest}
    >
      {armed ? ask : (children ?? label)}
    </button>
  )
}
