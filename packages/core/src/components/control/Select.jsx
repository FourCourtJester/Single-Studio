import { useId } from 'react'

import { useDraftValue } from '../../studio/DraftProvider'
import { cx } from '../../toolkits/cx'

/**
 * Dropdown bound to a path, staged until saved.
 *
 * Staged rather than immediate for consistency with the fields beside it: a board
 * where some controls are live and others are not is worse than one where the rule
 * is simply "typing and picking need a save, buttons do not".
 *
 * The empty option always exists so a choice can be cleared. Saving '' deletes the
 * key, which makes a source fall back to its own default rather than hold a blank.
 */
export function Select({ name, label = 'Select', options = [], children, placeholder = '— none —', namespace = 'variables', className, ...rest }) {
  const path = `${namespace}.${name}`
  const { value, dirty, onChange, onKeyDown } = useDraftValue(path)
  const id = useId()

  return (
    <label className={cx('ss-select flex flex-col gap-1', className)} htmlFor={id}>
      {label ? (
        <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
          {label}
          {dirty ? <span aria-label="unsaved" title="Unsaved" className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" /> : null}
        </span>
      ) : null}
      <select
        id={id}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        data-dirty={dirty ? '' : undefined}
        className={cx(
          'rounded-md border bg-slate-900 px-3 py-2 text-slate-100 outline-none transition-colors',
          dirty ? 'border-amber-500/70 focus:border-amber-400' : 'border-slate-700 focus:border-sky-500',
        )}
        {...rest}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => {
          const optionValue = typeof option === 'string' ? option : option.value
          const optionLabel = typeof option === 'string' ? option : (option.label ?? option.value)

          return (
            <option key={optionValue} value={optionValue}>
              {optionLabel}
            </option>
          )
        })}
        {children}
      </select>
    </label>
  )
}
