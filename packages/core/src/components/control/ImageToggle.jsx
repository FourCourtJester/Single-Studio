import { useVelcroMutate } from '../../hooks/useVelcroMutate'
import { useVelcroValue } from '../../hooks/useVelcroValue'
import { cx } from '../../toolkits/cx'
import { Thumb } from './Thumb'

/** Where this component's values live. Not a prop: a studio never needs another. */
const NAMESPACE = 'toggles'

/**
 * @typedef {object} ImageToggleProps
 * @property {string} name - Names a value under `toggles` — e.g. `lowerthird`.
 * @property {string} [label] - Shown above the control.
 * @property {string} [image] - The picture on the button.
 * @property {string} [from] - Read the picture from this path instead of `image`.
 * @property {string[]} [group] - Every name in this one radio group, including this one.
 * @property {'sm'|'md'|'lg'} [size] - Defaults to `"md"`.
 * @property {string} [className] - Added to the component's own classes.
 */
/**
 * An on/off button with a picture on it. `group` makes a row of them behave like
 * radio buttons, which is how a scene picker is usually built. Writes immediately.
 *
 * **`group` is one group, not a list of groups.** List every name that belongs to
 * it, this component's own included, and give the same list to each button in the
 * row — turning one on turns the rest off. Two buttons with different lists are two
 * separate groups, which is how you build two rows that do not interfere.
 *
 * Same behaviour exactly -- on/off at a path, or radio behaviour across a `group` --
 * only the face is the thing being toggled rather than its name. For a board where
 * the choice *is* a picture (a faction crest, a commander portrait) that is the
 * difference between reading nine words and recognising nine images, which matters
 * when the pick has to happen inside a draft timer.
 *
 * Immediate, like every other button. A picture is not a sentence; there is nothing
 * to finish typing, so there is nothing to stage.
 *
 * `from` points the face at a path instead of a fixed file, which is what a switch
 * for something the operator also *chooses* wants: the sponsor toggle should show
 * the sponsor they picked, not a placeholder that never changes. `image` stays as
 * the fallback for before anything is chosen.
 *
 * @example
 * <ImageToggle name="lowerthird" label="Lower third" image="/ui/lower-third.svg" />
 *
 * @example
 * // One at a time. Every button in the row gets this same list, itself included
 * <ImageToggle name="replay" image="/ui/replay.svg" group={['replay', 'live', 'stats']} />
 * <ImageToggle name="live" image="/ui/live.svg" group={['replay', 'live', 'stats']} />
 * <ImageToggle name="stats" image="/ui/stats.svg" group={['replay', 'live', 'stats']} />
 *
 * @example
 * // The picture comes from whatever the operator picked, not a fixed file
 * <ImageToggle name="sponsor" from="variables.sponsor.logo" image="/ui/sponsor.svg" />
 *
 * @param {ImageToggleProps & import("react").ButtonHTMLAttributes<HTMLElement>} props
 */
export function ImageToggle({ name, label, image, from, group, size = 'md', className, ...rest }) {
  const path = `${NAMESPACE}.${name}`
  const active = Boolean(useVelcroValue(path, false))
  const chosen = useVelcroValue(from, null)
  const mutate = useVelcroMutate()

  const onClick = () => {
    if (group?.length) {
      mutate('only', { group: group.map((key) => `${NAMESPACE}.${key}`), active: active ? null : path })
      return
    }

    mutate('toggle', path)
  }

  const caption = label ?? name

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={caption}
      className={cx(
        'ss-image-toggle flex flex-col items-center gap-1 rounded-md border p-1.5 transition-colors',
        active ? 'border-sky-500 bg-sky-950/60' : 'border-slate-800 bg-slate-900 hover:border-slate-600',
        className,
      )}
      {...rest}
    >
      <span className={cx('flex items-center justify-center overflow-hidden rounded', size === 'sm' ? 'h-10 w-10' : size === 'lg' ? 'h-20 w-20' : 'h-14 w-14')}>
        <Thumb src={chosen || image} label={caption} />
      </span>
      {caption ? <span className={cx('max-w-[6rem] truncate text-[0.7rem]', active ? 'text-sky-200' : 'text-slate-400')}>{caption}</span> : null}
    </button>
  )
}
