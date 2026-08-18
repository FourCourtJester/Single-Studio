import { useVelcroMutate } from '../../hooks/useVelcroMutate'
import { useVelcroValue } from '../../hooks/useVelcroValue'
import { cx } from '../../toolkits/cx'
import { Thumb } from './Thumb'

/**
 * <ToggleButton> with a picture on it.
 *
 * Same behaviour exactly -- on/off at a path, or radio behaviour across a `group` --
 * only the face is the thing being toggled rather than its name. For a board where
 * the choice *is* a picture (a faction crest, a commander portrait) that is the
 * difference between reading nine words and recognising nine images, which matters
 * when the pick has to happen inside a draft timer.
 *
 * Immediate, like every other button. A picture is not a sentence; there is nothing
 * to finish typing, so there is nothing to stage.
 */
export function ImageToggle({ name, label, image, group, size = 'md', namespace = 'toggles', className, ...rest }) {
  const path = `${namespace}.${name}`
  const active = Boolean(useVelcroValue(path, false))
  const mutate = useVelcroMutate()

  const onClick = () => {
    if (group?.length) {
      mutate('only', { group: group.map((key) => `${namespace}.${key}`), active: active ? null : path })
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
        <Thumb src={image} label={caption} />
      </span>
      {caption ? <span className={cx('max-w-[6rem] truncate text-[0.7rem]', active ? 'text-sky-200' : 'text-slate-400')}>{caption}</span> : null}
    </button>
  )
}
