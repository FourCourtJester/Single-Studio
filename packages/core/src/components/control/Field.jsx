import { useId } from 'react'

import { usePathPresence } from '../../hooks/useSync'
import { useDraftValue } from '../../studio/DraftProvider'
import { cx } from '../../toolkits/cx'
import { Tooltip } from '../common/Tooltip'

/** Where this component's values live. Not a prop: a studio never needs another. */
const NAMESPACE = 'variables'

/**
 * @typedef {object} FieldProps
 * @property {string} name - Names a value under `variables` — e.g. `home.score`.
 * @property {string} [label] - Shown above the control.
 * @property {string} [placeholder] - Hint shown in the empty input.
 * @property {string} [className] - Added to the component's own classes.
 */

/**
 * @typedef {object} TextAreaProps
 * @property {string} name - Names a value under `variables` — e.g. `home.score`.
 * @property {string} [label] - Shown above the control.
 * @property {string} [placeholder] - Hint shown in the empty box.
 * @property {number} [rows] - How many lines tall. Defaults to `3`.
 * @property {string} [className] - Added to the component's own classes.
 */

/**
 * One line of text an operator types, bound to a path. Staged until saved.
 *
 * For several lines — a bio, a crawl, a block of notes — use <TextArea>, which is
 * this component with a taller box and nothing else different.
 *
 * Controlled is safe now that edits are local: there is no round-trip through the
 * worker to fight the cursor. And while a field is dirty its staged value wins over
 * the store, so a remote change cannot yank text out from under an operator
 * mid-edit.
 *
 * Staged until saved, so a half-typed name never reaches air. An operator types at
 * their own pace and revises mid-word; writing every keystroke through would put
 * "Vand" on the lower third while somebody was still thinking. Save commits it —
 * button, Ctrl/Cmd+S, or Enter. Escape abandons this field's edit.
 *
 * @example
 * <Field name="home.name" label="Home" placeholder="Home team" />
 *
 * @example
 * // A dotted name groups related values; nothing has to declare the group
 * <Field name="lowerthird.headline" label="Headline" />
 *
 * @param {FieldProps & import("react").HTMLAttributes<HTMLElement>} props
 */
export function Field(props) {
  return <Input {...props} as="input" />
}

/**
 * Several lines of text an operator types, bound to a path. Staged until saved.
 *
 * <Field> with a taller box: same path, same staging, same unsaved marker, and a
 * source reading the value cannot tell which of the two wrote it. Reach for this
 * where the text has its own line breaks — a guest bio, a ticker crawl, a block of
 * notes — and for anything that fits on one line reach for <Field>.
 *
 * Staged until saved, exactly as <Field> is. Enter inserts a line break here rather
 * than committing — a multi-line box that cannot take a line break is not one — so
 * saving is Ctrl/Cmd+S or the save button. Escape still abandons the edit.
 *
 * @example
 * <TextArea name="guest.bio" label="Guest bio" rows={4} />
 *
 * @example
 * <TextArea name="ticker" label="Crawl text" rows={2} placeholder="One item per line" />
 *
 * @param {TextAreaProps & import("react").HTMLAttributes<HTMLElement>} props
 */
export function TextArea({ rows = 3, ...props }) {
  return <Input {...props} as="textarea" rows={rows} />
}

/**
 * The shared implementation.
 *
 * `as` lives here rather than on <Field> deliberately. It was a prop, and a prop
 * that changes which element renders is a prop every reader has to check before
 * they know what they are looking at -- and the only two answers were worth a name
 * each. Two components, no attribute, and the one people reach for most is the
 * one with the shortest call.
 */
function Input({ name, label, placeholder, as = 'input', rows, className, ...rest }) {
  const path = `${NAMESPACE}.${name}`
  const { value, dirty, onChange, onKeyDown } = useDraftValue(path)
  const busy = usePathPresence(path)
  const id = useId()
  const multiline = as === 'textarea'
  const Tag = multiline ? 'textarea' : 'input'

  /**
   * Enter makes a new line in a box that has lines, and saves in one that does not.
   *
   * The draft handler commits on Enter, which is right for a one-line field -- type
   * a name, press Enter, it is on air. In a textarea it made the newline key
   * unreachable: an operator typing a second line of a bio committed the first
   * instead, and the only way to get a line break was a chord nothing told them
   * about. A multi-line box that cannot take a line break is not one.
   *
   * Nothing is lost by it. Ctrl/Cmd+S is a window listener, so it saves from
   * anywhere including here, the save button is on the page, and Escape still
   * abandons the edit.
   */
  const keys = multiline ? (event) => (event.key === 'Enter' ? undefined : onKeyDown(event)) : onKeyDown

  return (
    <label className={cx('ss-field flex flex-col gap-1', className)} htmlFor={id}>
      {label ? (
        <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
          {label}
          {/* Unsaved marker. An operator has to be able to see at a glance that
              what is on their screen is not what is on air. */}
          {dirty ? <span aria-label="unsaved" title="Unsaved" className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" /> : null}
          {/* Somebody else has this field open. A warning rather than a lock: two
              operators in one field is a conversation to have, not a state to
              forbid, and a lock is something that can strand a board when a laptop
              closes. */}
          {busy.length ? (
            <Tooltip
              label={`${
                busy
                  .map((peer) => peer.name)
                  .filter(Boolean)
                  .join(', ') || 'Someone else'
              } is editing this`}
            >
              <span className="ss-field-busy flex items-center gap-1 rounded bg-sky-500/15 px-1 text-[0.6rem] font-medium normal-case tracking-normal text-sky-300">
                <span className="h-1 w-1 rounded-full bg-sky-400" />
                {busy.map((peer) => peer.name).filter(Boolean)[0] ?? 'in use'}
              </span>
            </Tooltip>
          ) : null}
        </span>
      ) : null}
      <Tag
        id={id}
        rows={multiline ? rows : undefined}
        placeholder={placeholder ?? label ?? name}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={keys}
        data-dirty={dirty ? '' : undefined}
        className={cx(
          'rounded-md border bg-slate-900 px-3 py-2 text-slate-100 outline-none transition-colors placeholder:text-slate-600',
          dirty ? 'border-amber-500/70 focus:border-amber-400' : 'border-slate-700 focus:border-sky-500',
        )}
        {...rest}
      />
    </label>
  )
}
