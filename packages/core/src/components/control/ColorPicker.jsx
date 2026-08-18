import { useId } from 'react'

import { useDraftValue } from '../../studio/DraftProvider'
import { cx } from '../../toolkits/cx'

/**
 * A colour, as a swatch to pick from and a hex field to type into.
 *
 * A `Scene`'s `vars` can map any path onto a CSS custom property, which makes an
 * operator-chosen colour drive anything a stylesheet can express. That is only
 * useful if choosing one does not require knowing that amber is #f59e0b.
 *
 * Both halves write the same path, so an operator can pick from the swatch or
 * paste a brand hex from a style guide -- and the two stay in step, because the
 * swatch reads back whatever the field holds.
 *
 * Staged like a `Field`, and for the same reason: typing `#f5` mid-hex would
 * otherwise put a half-parsed colour on air. `presets` puts a studio's own palette
 * one click away, which is the common case -- most shows have four colours, not
 * sixteen million.
 */
const HEX = /^#[0-9a-f]{6}$/i

/** The swatch input only accepts `#rrggbb`, so anything else shows as the default. */
const swatchValue = (value, fallback) => (HEX.test(String(value ?? '').trim()) ? String(value).trim() : fallback)

export function ColorPicker({ name, label = 'Colour', presets = [], fallback = '#0ea5e9', namespace = 'variables', className, ...rest }) {
  const path = `${namespace}.${name}`
  const { value, dirty, onChange, onKeyDown } = useDraftValue(path)
  const id = useId()

  return (
    <section className={cx('ss-color-picker flex flex-col gap-1', className)} {...rest}>
      <label htmlFor={id} className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
        {dirty ? <span aria-label="unsaved" title="Unsaved" className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" /> : null}
      </label>

      {/* Joined as one control: the swatch is the left cap of the hex field. */}
      <div className="ss-input-group flex">
        <input
          type="color"
          value={swatchValue(value, fallback)}
          onChange={(event) => onChange(event.target.value)}
          aria-label={`${label} swatch`}
          className={cx(
            'ss-swatch h-[2.375rem] w-11 shrink-0 cursor-pointer rounded-l-md border bg-slate-900 p-1 outline-none transition-colors',
            dirty ? 'border-amber-500/70' : 'border-slate-700',
          )}
        />
        <input
          id={id}
          value={value ?? ''}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={fallback}
          spellCheck={false}
          aria-label={label}
          data-dirty={dirty ? '' : undefined}
          className={cx(
            '-ml-px min-w-0 grow rounded-r-md border bg-slate-900 px-3 py-2 font-mono text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-600 focus:relative',
            dirty ? 'border-amber-500/70 focus:border-amber-400' : 'border-slate-700 focus:border-sky-500',
          )}
        />
      </div>

      {presets.length ? (
        <div className="flex flex-wrap gap-1 pt-0.5">
          {presets.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => onChange(preset)}
              aria-label={preset}
              title={preset}
              style={{ background: preset }}
              className={cx(
                'ss-color-preset h-5 w-5 rounded border transition-transform hover:scale-110',
                String(value).toLowerCase() === preset.toLowerCase() ? 'border-white' : 'border-slate-700',
              )}
            />
          ))}
        </div>
      ) : null}
    </section>
  )
}
