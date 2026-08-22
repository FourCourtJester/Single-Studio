import { useRef, useState } from 'react'

import { useVelcroMutate } from '../../hooks/useVelcroMutate'
import { useVelcroValue } from '../../hooks/useVelcroValue'
import { cx } from '../../toolkits/cx'

/**
 * @typedef {object} StepperProps
 * @property {string} name - Path under `namespace`, e.g. `home.score`.
 * @property {string} [label] - Shown above the control.
 * @property {number} [step] - How much the -/+ buttons add, and the field's arrow keys. Defaults to `1`.
 * @property {string} [namespace] - Where the value lives. Defaults to `variables`.
 * @property {string} [className] - Added to the component's own classes.
 */
/**
 * A number with minus and plus buttons, and a field to type into. The buttons add
 * and subtract, so two operators pressing +1 at once come to +2 rather than +1.
 *
 * The buttons use the `increment`/`decrement` mutations rather than writing an
 * absolute value, which is what makes two operators tapping +1 at the same moment
 * add up to +2 instead of clobbering each other. See velcro/counter.js.
 *
 * **The field writes an absolute value, and that is the point.** Going from 3 to 10
 * by pressing + seven times is not a control, it is a penalty, and the case it
 * happens in -- a score corrected after a review, a clock put where it should have
 * been -- is exactly the case where somebody is in a hurry. Typing a number means
 * "it is this now", which is a different intention from "add one" and deserves a
 * different write. The cost is honest: an absolute write lands on top of whatever
 * anybody else was adding at that instant, because that is what correcting a value
 * means.
 *
 * Committed on Enter or on leaving the field, never per keystroke. Typing "10"
 * passes through "1", and a board that wrote every keystroke would put a 1 on air
 * on the way to a 10. Escape abandons the edit -- the same bargain `Field` makes
 * with text, for the same reason.
 *
 * `step` sizes the buttons and the field's own arrow keys alike, so a stepper for
 * a sport scoring in threes is `step={3}` and nothing else changes.
 *
 * @example
 * <Stepper name="home.score" label="Home score" />
 *
 * @example
 * // A sport that scores in threes
 * <Stepper name="home.score" label="Home score" step={3} />
 *
 * @param {StepperProps & import("react").HTMLAttributes<HTMLElement>} props
 */
export function Stepper({ name, label, step = 1, namespace = 'variables', className, ...rest }) {
  const path = `${namespace}.${name}`
  const value = useVelcroValue(path, 0)
  const mutate = useVelcroMutate()

  // Null when not being edited, which is what lets a remote change land in the
  // field of somebody who is not typing in it and leave alone the field of somebody
  // who is. A plain controlled input would fight the cursor of whoever is mid-entry.
  const [draft, setDraft] = useState(null)

  /**
   * The same value in a ref, and `commit` reads *this* one.
   *
   * Because Escape has to both abandon the edit and leave the field, and those are
   * a state update and a blur in that order -- so the blur handler runs with the
   * render that is still holding the abandoned text. Reading state there put the
   * discarded number on air, which is precisely the thing Escape was pressed to
   * prevent. A ref is current the instant it is written, which is what a handler
   * firing inside the same tick needs.
   */
  const typed = useRef(null)
  const current = Number(value ?? 0)
  const dirty = draft !== null && draft !== String(current)

  const stage = (next) => {
    typed.current = next
    setDraft(next)
  }

  const abandon = () => {
    typed.current = null
    setDraft(null)
  }

  const commit = () => {
    const entered = typed.current

    abandon()

    if (entered === null) return

    const next = Number(entered)

    // Empty or nonsense reverts rather than writing. A cleared field means somebody
    // is part-way through typing or changed their mind; writing 0 for it would be
    // inventing a number nobody asked for, on air.
    if (!entered.trim() || !Number.isFinite(next) || next === current) return

    mutate('set', { [path]: next })
  }

  const button = 'h-9 w-9 shrink-0 rounded-md border border-slate-700 bg-slate-900 text-lg leading-none text-slate-200 transition-colors hover:border-slate-500'

  return (
    <div className={cx('ss-stepper flex flex-col gap-1', className)} {...rest}>
      {label ? <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span> : null}
      <div className="flex items-center gap-2">
        <button type="button" aria-label={`Decrease ${label ?? name}`} className={button} onClick={() => mutate('decrement', { [path]: step })}>
          &minus;
        </button>
        <input
          type="number"
          inputMode="numeric"
          step={step}
          value={draft ?? String(current)}
          onChange={(event) => stage(event.target.value)}
          onFocus={(event) => event.target.select()}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              event.currentTarget.blur()
            }

            if (event.key === 'Escape') {
              abandon()
              event.currentTarget.blur()
            }
          }}
          aria-label={label ?? name}
          data-dirty={dirty ? '' : undefined}
          /* The native spinners are hidden rather than styled. They would sit beside
             the -/+ buttons doing the same job by a different rule -- an absolute
             write where the buttons add -- and two controls a pixel apart that
             disagree about what they mean is worse than one control fewer. */
          className={cx(
            'ss-stepper-value w-16 min-w-0 rounded-md border bg-slate-950 px-2 py-1.5 text-center text-xl font-semibold tabular-nums text-slate-100 outline-none transition-colors',
            '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
            dirty ? 'border-amber-500/70 focus:border-amber-400' : 'border-transparent focus:border-sky-500',
          )}
        />
        <button type="button" aria-label={`Increase ${label ?? name}`} className={button} onClick={() => mutate('increment', { [path]: step })}>
          +
        </button>
      </div>
    </div>
  )
}
