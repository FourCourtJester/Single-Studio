import { createContext, useContext, useSyncExternalStore } from 'react'

// What the control page shares with what is on it: the slot `BoardBar` draws into,
// and the panels, so `PanelJump` can list, fold and open them.
//
// The panels are a registry rather than state the page holds because a panel's fold
// is its own: `Panel` keeps it in component state, on purpose (see Panel.jsx), and
// a jump has to reach into every one of them. Each panel hands the page a way to
// open or fold it; the page never owns the answer.
//
// Null outside a control page -- a Panel in a test, a graphic, a studio's own page
// -- and everything that reads it does nothing there rather than throwing.

export const BoardContext = createContext(null)

/** The panel a panel is inside, so a jump to it opens its parent too. */
export const PanelParent = createContext(null)

export function createBoard() {
  const panels = new Map()
  const listeners = new Set()
  let version = 0

  const changed = () => {
    version += 1
    for (const listener of listeners) listener()
  }

  return {
    /** Returns the function that takes it back out. */
    register(id, entry) {
      panels.set(id, entry)
      changed()

      return () => {
        panels.delete(id)
        changed()
      }
    },
    subscribe(listener) {
      listeners.add(listener)

      return () => listeners.delete(listener)
    },
    version: () => version,
    /**
     * Every panel on the board, in the order the operator sees them. Ordered by the
     * page rather than by registration: effects run child before parent, so a panel
     * inside another registers first, and a panel mounted later -- a section behind a
     * toggle -- registers last wherever it sits.
     */
    list() {
      return [...panels.entries()]
        .map(([id, entry]) => ({ id, ...entry }))
        .filter((entry) => entry.element())
        .sort((a, b) => (a.element().compareDocumentPosition(b.element()) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
    },
  }
}

const nothing = () => () => {}
const zero = () => 0

/** The board's panels, re-read whenever one comes, goes or is renamed. */
export function useBoardPanels() {
  const board = useContext(BoardContext)?.board

  useSyncExternalStore(board?.subscribe ?? nothing, board?.version ?? zero)

  return board ? board.list() : []
}
