/**
 * Where the holding slide looks for its pictures.
 *
 * Imported by the graphic and by the board, because the two have to agree: the
 * board tells the operator what to file images under, and the graphic plays
 * whatever is filed there.
 *
 * The image store already files by group -- drop a folder in and its name becomes
 * the prefix, or type one in the box above the drop zone -- so this needs no
 * picker of its own. Everything under `slides/` plays; anything else in the store
 * (the tournament mark, say) does not.
 */
export const SLIDE_PREFIX = 'slides/'
