import { cx } from '../../toolkits/cx'

/**
 * The framework's icons, drawn inline.
 *
 * Deliberately not an icon package. A control surface needs a handful of glyphs,
 * and every packaged alternative costs something this project cannot spend: a font
 * kit fetches from a CDN, which is dead weight in OBS and dead full stop offline;
 * a component library becomes a dependency every studio inherits whether or not it
 * renders a single icon. Six paths in one file cost nothing and cannot fail to
 * load.
 *
 * They are stroked with `currentColor` at a uniform weight, so an icon inherits the
 * colour of whatever button it sits in and needs no per-use styling. Size with a
 * utility class -- the default matches the text beside it.
 *
 * The seam is `<Icon name="save" />`. Swapping the whole set for lucide-react later
 * is a change to this file and nowhere else.
 */
const shapes = {
  /* A floppy disk: shutter at the top, label at the bottom, corner clipped. */
  save: (
    <>
      <path d="M4.5 4h10l5 5v11h-15z" />
      <path d="M8.5 4v4.5h6V4" />
      <path d="M7.5 20v-6h9v6" />
    </>
  ),
  close: (
    <>
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5L21 21" />
    </>
  ),
}

export function Icon({ name, label, className, ...rest }) {
  const shape = shapes[name]

  if (!shape) return null

  // An icon inside a button that already has an accessible name is decoration, and
  // announcing it again just makes the button read twice. `label` is for the other
  // case -- an icon standing alone as the whole meaning.
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : 'true'}
      focusable="false"
      className={cx('ss-icon h-4 w-4 shrink-0', className)}
      {...rest}
    >
      {shape}
    </svg>
  )
}
