/** Tiny classnames join. Not worth a dependency. */
export const cx = (...parts) => parts.flat(Infinity).filter(Boolean).join(' ')
