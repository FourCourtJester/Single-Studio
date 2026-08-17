import { useEffect, useId, useRef } from 'react'

import { useVelcroMutate } from '../../hooks/useVelcroMutate'
import { useVelcroValue } from '../../hooks/useVelcroValue'
import { cx } from '../../toolkits/cx'

/**
 * Text input bound to a path.
 *
 * Uncontrolled on purpose. A controlled input round-trips every keystroke
 * through the worker, which fights the operator's cursor; instead the DOM owns
 * the value while focused and Velcro only writes back over it when the change
 * came from somewhere else. That is also exactly the behaviour multi-operator
 * editing needs later.
 */
export function Field({ name, label, placeholder, as = 'input', rows = 3, namespace = 'variables', debounce = 250, className, ...rest }) {
  const path = `${namespace}.${name}`
  const value = useVelcroValue(path, '')
  const mutate = useVelcroMutate()
  const ref = useRef(null)
  const timer = useRef(null)
  const id = useId()
  const Tag = as === 'textarea' ? 'textarea' : 'input'

  useEffect(() => {
    const element = ref.current

    if (!element || element === document.activeElement) return

    element.value = value ?? ''
  }, [value])

  const onChange = (event) => {
    const next = event.target.value

    clearTimeout(timer.current)
    timer.current = setTimeout(() => mutate('set', { [path]: next }), debounce)
  }

  useEffect(() => () => clearTimeout(timer.current), [])

  return (
    <label className={cx('ss-field flex flex-col gap-1', className)} htmlFor={id}>
      {label ? <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span> : null}
      <Tag
        ref={ref}
        id={id}
        rows={as === 'textarea' ? rows : undefined}
        placeholder={placeholder ?? label ?? name}
        defaultValue={value ?? ''}
        onChange={onChange}
        className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none transition-colors placeholder:text-slate-600 focus:border-sky-500"
        {...rest}
      />
    </label>
  )
}
