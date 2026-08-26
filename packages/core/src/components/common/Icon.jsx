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
 * (There are more than six now. The argument holds until the day a studio wants a
 * glyph this file does not have, which is the day to reach for a package.)
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
  menu: (
    <>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </>
  ),
  /* A keyboard: the case, two rows of keys, and a space bar. */
  keyboard: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <path d="M6 9.5h.01" />
      <path d="M9.5 9.5h.01" />
      <path d="M13 9.5h.01" />
      <path d="M16.5 9.5h.01" />
      <path d="M6 12.75h.01" />
      <path d="M9.5 12.75h.01" />
      <path d="M13 12.75h.01" />
      <path d="M16.5 12.75h.01" />
      <path d="M8 15.5h8" />
    </>
  ),
  /* A picture: frame, sun, and the hill a photo icon always has. */
  image: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <circle cx="9" cy="10" r="1.75" />
      <path d="M4 17l4.5-4.5 3.5 3.5 3-2.5 5 4" />
    </>
  ),
  /* A monitor: what a browser source ends up being, in a scene. */
  screen: (
    <>
      <rect x="3" y="4.5" width="18" height="12" rx="2" />
      <path d="M9 20h6" />
      <path d="M12 16.5V20" />
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
  /* An arrow coming back round to where it started. Undo, at the scale of a show. */
  revert: (
    <>
      <path d="M4 10h6" />
      <path d="M4 10V4" />
      <path d="M6.3 16a8 8 0 1 0 .5-8" />
    </>
  ),
  /* Two figures: one nearer, one behind. Collaboration, without a metaphor. */
  people: (
    <>
      <circle cx="9" cy="8" r="3.25" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.5a3.25 3.25 0 0 1 0 6" />
      <path d="M17.5 14.5a5.5 5.5 0 0 1 3 5.5" />
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
