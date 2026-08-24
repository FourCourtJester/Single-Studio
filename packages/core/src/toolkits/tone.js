// The five things a button can mean, named once.
//
// Colour was being decided per component: rose in Confirm, amber in SwapButton,
// sky in the Collaborate dialog, slate everywhere else. Each choice was reasonable
// where it was made and none of them knew about the others, so a board assembled
// from them had no rule an operator could learn -- and a studio wanting its own
// palette had to override component by component.
//
// So the meanings get names and the names carry the colour. A studio picks a tone
// for what a button *is*, not what colour it should be, which is also the thing
// that survives a redesign.
//
// Every tone carries a stable `ss-tone-*` class alongside its utilities. That is
// the seam for a studio with its own palette: framework rules ship inside
// `@layer components`, and unlayered CSS beats a layer regardless of specificity,
// so a plain rule in a studio's stylesheet wins with nothing to fight.
//
//   .ss-tone-danger { background: #7f1d1d; border-color: #ef4444; color: #fff; }

/**
 * @typedef {'danger'|'warn'|'go'|'primary'|'quiet'} Tone
 */

export const TONES = {
  /** Something is destroyed or cannot be undone. Wipes, removals, rotating a key. */
  danger: 'ss-tone-danger border border-rose-500/50 bg-rose-500/10 text-rose-300 hover:border-rose-400 hover:text-rose-200',

  /** Reversible, but somebody should look up first. Disconnecting, resetting a clock. */
  warn: 'ss-tone-warn border border-amber-500/50 bg-amber-500/10 text-amber-200 hover:border-amber-400 hover:text-amber-100',

  /** The affirmative one. Going live, sending an invite, committing a draft. */
  go: 'ss-tone-go border border-emerald-500/50 bg-emerald-500/10 text-emerald-200 hover:border-emerald-400 hover:text-emerald-100',

  /** The main action of a panel, where there is exactly one. */
  primary: 'ss-tone-primary border border-sky-600 bg-sky-600 text-white hover:border-sky-500 hover:bg-sky-500',

  /** Everything else. The default, because most buttons on a board are ordinary. */
  quiet: 'ss-tone-quiet border border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500 hover:text-slate-100',
}

/**
 * The classes for a tone, falling back to `quiet` rather than to nothing.
 *
 * An unknown tone is a typo, and a typo that renders an unstyled button looks like
 * a broken stylesheet rather than a misspelt word. Falling back keeps the board
 * usable while the name is still wrong.
 */
export const toneClass = (tone) => TONES[tone] ?? TONES.quiet

/** The one every armed control shares, so "about to happen" reads the same everywhere. */
export const ARMED_TONE = 'ss-tone-armed border-amber-400 bg-amber-500/15 text-amber-200'
