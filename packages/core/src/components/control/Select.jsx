import { useEffect, useId, useRef } from 'react'

import { useVelcroMutate } from '../../hooks/useVelcroMutate'
import { useVelcroValue } from '../../hooks/useVelcroValue'
import { cx } from '../../toolkits/cx'

/**
 * Dropdown bound to a path.
 *
 * `options` takes plain strings or `{ value, label }` pairs; children are
 * accepted too for anything more involved. The empty option is always present so
 * an operator can clear a choice -- writing '' deletes the key, which is what
 * makes a source fall back to its own default rather than render a stale value.
 */
export function Select({ name, label = 'Select', options = [], children, placeholder = '— none —', namespace = 'variables', className, ...rest }) {
  const path = `${namespace}.${name}`
  const value = useVelcroValue(path, '')
  const mutate = useVelcroMutate()
  const ref = useRef(null)
  const id = useId()

  // Keep the DOM in step with remote changes without fighting an open dropdown.
  useEffect(() => {
    const element = ref.current

    if (element && element !== document.activeElement) element.value = value ?? ''
  }, [value])

  return (
    <label className={cx('ss-select flex flex-col gap-1', className)} htmlFor={id}>
      {label ? <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span> : null}
      <select
        ref={ref}
        id={id}
        defaultValue={value ?? ''}
        onChange={(event) => mutate('set', { [path]: event.target.value })}
        className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none transition-colors focus:border-sky-500"
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
