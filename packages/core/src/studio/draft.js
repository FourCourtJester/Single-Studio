// Staged edits, waiting for a save.
//
// Text fields do not write as you type. An operator types at their own speed and
// changes their mind mid-word, and every intermediate state of that would go
// straight to air -- "Vand", "Vanders", "Vandersteen" on the lower third while
// somebody thinks. So free-text controls stage their value here and a save commits
// the lot.
//
// Buttons are exempt and stay immediate: a stepper, a toggle, a swap is a single
// deliberate act with no half-finished state to protect.
//
// Committing everything in one mutation is not just tidier, it is more correct.
// One `set` is one Yjs transaction, so home and away names land on air in the same
// frame instead of a couple of hundred milliseconds apart.
//
// Pure functions, so this is testable without React.

export const EMPTY = Object.freeze({})

/**
 * Stage a value, unless it matches what is already stored -- typing a change and
 * then undoing it should leave nothing pending, not a phantom unsaved edit.
 */
export function stage(draft, path, value, stored) {
  if (arguments.length > 3 && Object.is(value, stored)) return unstage(draft, path)
  if (Object.is(draft[path], value)) return draft

  return { ...draft, [path]: value }
}

export function unstage(draft, path) {
  if (!(path in draft)) return draft

  const next = { ...draft }

  delete next[path]

  return next
}

export const has = (draft, path) => Object.prototype.hasOwnProperty.call(draft, path)

/** The staged value if there is one, otherwise whatever is stored. */
export const resolve = (draft, path, stored) => (has(draft, path) ? draft[path] : stored)

export const paths = (draft) => Object.keys(draft)

export const count = (draft) => paths(draft).length

export const isDirty = (draft) => count(draft) > 0

/** The payload for a single `set` mutation. */
export const payload = (draft) => ({ ...draft })
