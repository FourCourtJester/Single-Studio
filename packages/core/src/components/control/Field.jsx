import { useId } from 'react'

import { useDraftValue } from '../../studio/DraftProvider'
import { cx } from '../../toolkits/cx'

/**
 * Text input bound to a path, staged until saved.
 *
 * Nothing here reaches air as you type. An operator types at their own pace and
 * revises mid-word; writing every keystroke through would put "Vand" on the lower
 * third while somebody was still thinking. Save commits it — button, Ctrl/Cmd+S,
 * or Enter. Escape abandons this field's edit.
 *
 * Controlled is safe now that edits are local: there is no round-trip through the
 * worker to fight the cursor. And while a field is dirty its staged value wins over
 * the store, so a remote change cannot yank text out from under an operator
 * mid-edit.
 */
export function Field({ name, label, placeholder, as = 'input', rows = 3, namespace = 'variables', className, ...rest }) {
  const path = `${namespace}.${name}`
  const { value, dirty, onChange, onKeyDown } = useDraftValue(path)
  const id = useId()
  const Tag = as === 'textarea' ? 'textarea' : 'input'

  return (
    <label className={cx('ss-field flex flex-col gap-1', className)} htmlFor={id}>
      {label ? (
        <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
          {label}
          {/* Unsaved marker. An operator has to be able to see at a glance that
              what is on their screen is not what is on air. */}
          {dirty ? <span aria-label="unsaved" title="Unsaved" className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" /> : null}
        </span>
      ) : null}
      <Tag
        id={id}
        rows={as === 'textarea' ? rows : undefined}
        placeholder={placeholder ?? label ?? name}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
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
