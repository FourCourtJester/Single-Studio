import { useEffect, useRef, useState } from 'react'

import { AssetLibraryDialog } from './AssetLibrary'
import { Collaborate, CollaborateDialog } from './Collaborate'
import { ResetDialog } from './Reset'
import { SourceListDialog } from './SourceList'
import { cx } from '../../toolkits/cx'
import { Icon } from '../common/Icon'
import { Tooltip } from '../common/Tooltip'

/**
 * The board's own controls, gathered behind one button.
 *
 * These -- the room, the image library, the OBS URLs, the ways to start over --
 * have nothing to do with the show being run. They are setup, opened rarely, and
 * each one had found its own way onto the header or the bottom of the page, where
 * they competed for room with the fields an operator touches every minute. A dock is often a narrow
 * column beside a preview; that space belongs to the show.
 *
 * The connection light stays outside the menu on purpose. Everything in here is
 * something you go looking for; that is the one thing that has to find *you*.
 */
const ITEMS = [
  { key: 'collaborate', icon: 'people', label: 'Collaborate', hint: 'Bring other operators into this show' },
  { key: 'images', icon: 'image', label: 'Image store', hint: 'Add, name and remove images' },
  { key: 'sources', icon: 'screen', label: 'Browser sources', hint: 'The URLs to paste into OBS' },
  // Last, and on its own side of a rule. Everything above opens something; this one
  // undoes something, and a destructive item sitting flush against three harmless
  // ones is a mis-click waiting for a bad night.
  { key: 'reset', icon: 'revert', label: 'Start over', hint: 'Reset the show, leave the room, or wipe this machine', apart: true },
]

export function Menu({ className, ...rest }) {
  const [open, setOpen] = useState(false)
  const [showing, setShowing] = useState(null)
  const wrapper = useRef(null)

  /**
   * Close on anything that means "not this".
   *
   * Both listeners live on the document because the alternatives are worse: a blur
   * handler fires before the click it should have allowed, and a backdrop element
   * would sit over the header. `pointerdown` rather than `click` so the menu is
   * gone by the time whatever was underneath reacts.
   */
  useEffect(() => {
    if (!open) return undefined

    const away = (event) => {
      if (!wrapper.current?.contains(event.target)) setOpen(false)
    }

    const key = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', key)

    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', key)
    }
  }, [open])

  const show = (key) => {
    setShowing(key)
    setOpen(false)
  }

  const close = () => setShowing(null)

  return (
    <span ref={wrapper} className={cx('ss-menu relative flex items-center gap-2', className)} {...rest}>
      <Collaborate onOpen={() => show('collaborate')} />

      <Tooltip label="Setup" align="end">
        <button
          type="button"
          onClick={() => setOpen((was) => !was)}
          aria-label="Setup"
          aria-haspopup="menu"
          aria-expanded={open}
          className="ss-menu-open flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
        >
          <Icon name="menu" />
        </button>
      </Tooltip>

      {open ? (
        <div
          role="menu"
          className="ss-menu-panel absolute right-0 top-full z-50 mt-1.5 flex min-w-52 flex-col overflow-hidden rounded-lg border border-slate-700 bg-slate-900 py-1 shadow-xl shadow-black/50"
        >
          {ITEMS.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              onClick={() => show(item.key)}
              title={item.hint}
              className={cx(
                `ss-menu-${item.key}`,
                'flex items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-200 transition-colors hover:bg-slate-800',
                item.apart && 'mt-1 border-t border-slate-800 pt-2.5',
              )}
            >
              <Icon name={item.icon} className="h-4 w-4 shrink-0 text-slate-400" />
              {item.label}
            </button>
          ))}
        </div>
      ) : null}

      {/* Mounted only while showing, rather than sitting closed in the DOM.
          Partly cost -- the image library subscribes to the whole store and renders
          a tile per entry, and one running behind a closed dialog is work nobody can
          see. Mostly identity: every ImagePicker renders a library dialog of its
          own, so a permanent one up here in the header would be the first
          `.ss-asset-dialog` on the page and would answer for all of them. */}
      {showing === 'collaborate' ? <CollaborateDialog open onClose={close} /> : null}
      {showing === 'images' ? <AssetLibraryDialog open onClose={close} /> : null}
      {showing === 'sources' ? <SourceListDialog open onClose={close} /> : null}
      {showing === 'reset' ? <ResetDialog open onClose={close} /> : null}
    </span>
  )
}
