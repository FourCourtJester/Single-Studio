import { useDraftValue } from '../../studio/DraftProvider'
import { useVelcroMutate } from '../../hooks/useVelcroMutate'
import { cx } from '../../toolkits/cx'
import { Thumb } from './Thumb'

/** Where this component's values live. Not a prop: a studio never needs another. */
const NAMESPACE = 'variables'

const SIZES = { sm: 'h-10 w-10', md: 'h-14 w-14', lg: 'h-20 w-20' }

const optionValue = (option) => (typeof option === 'string' ? option : option.value)
const optionLabel = (option) => (typeof option === 'string' ? option : (option.label ?? option.value))
const optionImage = (option) => (typeof option === 'string' ? undefined : option.image)

/**
 * @typedef {object} ImageSelectProps
 * @property {string} name - Names a value under `variables` — e.g. `home.score`.
 * @property {string} [label] - Shown above the control. Defaults to `"Select"`.
 * @property {Array<string | { label?: string, value: string, image?: string }>} [options] - What can be chosen, shown as pictures. A bare string is all three.
 * @property {boolean} [multiple] - Choose several. The value becomes a comma-separated list.
 * @property {number} [max] - Cap on how many, when `multiple`.
 * @property {boolean} [staged] - Hold the choice until saved, rather than writing on click.
 * @property {'sm'|'md'|'lg'} [size] - Tile size. Defaults to `"md"`.
 * @property {string} [className] - Added to the component's own classes.
 */
/** Stored values arrive as an array, a bare string, or nothing at all. */
function toList(value) {
  if (Array.isArray(value)) return value
  if (value === undefined || value === null || value === '') return []

  return [value]
}

const same = (a, b) => a.length === b.length && a.every((item, index) => item === b[index])

/**
 * Choose by picture rather than by name — a grid of tiles, which is what an
 * operator can aim at inside a draft timer. `multiple` collects several. Writes immediately, or `staged` to hold it for a save.
 *
 * <Select> with the options laid out as a grid of image tiles. Same path, same
 * stored value -- a source reading `variables.home.faction` cannot tell which
 * control wrote it -- but the operator recognises art instead of reading a list.
 *
 * Each option is `{ label, value, image }`: the label names it, the value is what
 * lands on air, and the image is the tile. A bare string is all three at once.
 *
 * `multiple` stores an array in order of selection, which is what an army
 * composition, a ban list or a running order is. `max` stops the grid at a fixed
 * size rather than silently dropping the overflow.
 *
 * Immediate by default, because a tile is a button. Pass `staged` for a pick that
 * should wait with the text fields for a save -- a draft being assembled off-air
 * and revealed on the cut.
 *
 * @example
 * const FACTIONS = [
 *   { label: 'Vanguard', value: 'vanguard', image: './factions/vanguard.svg' },
 *   { label: 'Syndicate', value: 'syndicate', image: './factions/syndicate.svg' },
 * ]
 *
 * <ImageSelect name="home.faction" label="Faction" options={FACTIONS} />
 *
 * @example
 * // The other half of the pair, in a graphic rather than on the board: the value
 * // this control writes ('vanguard') is what <Image> templates into a file name.
 * // Keep the list in one module and import it into both, so the two cannot drift.
 * <Image name="home.faction" src="./factions/:value:.svg" alt="" />
 *
 * @example
 * // Several, capped, and held until saved
 * <ImageSelect name="home.army" label="Army" options={UNITS} multiple max={8} staged />
 *
 * @param {ImageSelectProps & import("react").HTMLAttributes<HTMLElement>} props
 */
export function ImageSelect({
  name,
  label = 'Select',
  options = [],
  multiple = false,
  max,
  staged = false,
  size = 'md',
  className,
  ...rest
}) {
  const path = `${NAMESPACE}.${name}`
  const draft = useDraftValue(path, multiple ? [] : '')
  const mutate = useVelcroMutate()

  const current = staged ? draft.value : draft.stored
  const selected = toList(current)
  const dirty = staged && draft.dirty
  const full = multiple && max !== undefined && selected.length >= Number(max)

  const commit = (next) => {
    // An empty selection stores '' so the key is deleted, letting a source fall
    // back to its own default rather than hold an empty array.
    const value = next.length ? (multiple ? next : next.at(0)) : ''

    if (!staged) {
      mutate('set', { [path]: value })
      return
    }

    // Arrays never compare equal by identity, so an operator toggling a pick off
    // and back on would otherwise leave the board looking dirty forever.
    if (same(next, toList(draft.stored))) draft.revert()
    else draft.onChange(value)
  }

  const pick = (value) => {
    if (!multiple) {
      commit(selected.includes(value) ? [] : [value])
      return
    }

    if (selected.includes(value)) {
      commit(selected.filter((item) => item !== value))
      return
    }

    if (full) return

    commit([...selected, value])
  }

  return (
    <fieldset className={cx('ss-image-select flex w-full flex-col gap-2', className)} {...rest}>
      {label ? (
        <legend className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
          {label}
          {multiple && max !== undefined ? (
            <span className="text-slate-500">
              {selected.length}/{max}
            </span>
          ) : null}
          {dirty ? <span aria-label="unsaved" title="Unsaved" className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" /> : null}
        </legend>
      ) : null}

      <div className="flex flex-wrap gap-2" role={multiple ? 'group' : 'radiogroup'} aria-label={label || name}>
        {options.map((option) => {
          const value = optionValue(option)
          const caption = optionLabel(option)
          const active = selected.includes(value)
          const order = multiple ? selected.indexOf(value) : -1
          const blocked = full && !active

          return (
            <button
              key={value}
              type="button"
              onClick={() => pick(value)}
              disabled={blocked}
              title={caption}
              role={multiple ? undefined : 'radio'}
              aria-checked={multiple ? undefined : active}
              aria-pressed={multiple ? active : undefined}
              data-value={value}
              className={cx(
                'ss-image-select-option relative flex flex-col items-center gap-1 rounded-md border p-1.5 transition-colors',
                active ? 'border-sky-500 bg-sky-950/60' : 'border-slate-800 bg-slate-900 hover:border-slate-600',
                blocked ? 'cursor-not-allowed opacity-40 hover:border-slate-800' : null,
                dirty && active ? 'border-amber-500/70' : null,
              )}
            >
              <span className={cx('flex items-center justify-center overflow-hidden rounded', SIZES[size] ?? SIZES.md)}>
                <Thumb src={optionImage(option)} label={caption} />
              </span>
              <span className={cx('max-w-[6rem] truncate text-[0.7rem]', active ? 'text-sky-200' : 'text-slate-400')}>{caption}</span>
              {order >= 0 ? (
                <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-sky-600 text-[0.6rem] font-semibold text-white">
                  {order + 1}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
