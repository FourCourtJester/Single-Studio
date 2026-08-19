import { useEffect, useRef, useState } from 'react'

import { useAssetStore } from '../../hooks/useAssets'
import { useRelay } from '../../hooks/useRelay'
import { useSyncStatus } from '../../hooks/useSync'
import { useVelcro } from '../../hooks/useVelcro'
import { useVelcroMutate } from '../../hooks/useVelcroMutate'
import { Confirm } from './Confirm'
import { Icon } from '../common/Icon'
import { Tooltip } from '../common/Tooltip'

/**
 * The ways out: start the show over, leave the room, wipe this machine.
 *
 * Gathered rather than scattered because they share a property nothing else on the
 * board has -- they undo work, and an operator reaching for one is usually reaching
 * for it in a hurry. Three buttons in three different corners is three places to
 * look while a segment is running; one place with the consequences written next to
 * each is a decision somebody can make in five seconds.
 *
 * Every one of them is armed-then-confirmed rather than immediate. See `Confirm`
 * for why that is not `window.confirm`.
 *
 * What is deliberately *not* here: removing the images. That lives in the image
 * library, next to the images, because it is the only one of these whose blast
 * radius is a thing you are looking at.
 */

/** The one namespace a show reset spares. See the `clear` mutation. */
const KEEP = 'assets'

/** Everything this board remembers about *this machine* rather than about the show. */
const LOCAL = 'single-studio:'

export function ResetDialog({ open, onClose }) {
  const dialog = useRef(null)
  const mutate = useVelcroMutate()
  const status = useSyncStatus()
  const { config, leave, rekey } = useRelay({ auto: false })
  const store = useAssetStore()
  const velcro = useVelcro()
  const [done, setDone] = useState(null)

  useEffect(() => {
    const element = dialog.current

    if (!element) return

    if (open && !element.open) element.showModal()
    if (!open && element.open) element.close()
  }, [open])

  // Cleared each time it opens, so a message from the last visit is not sitting
  // there reading like something that just happened.
  useEffect(() => {
    if (open) setDone(null)
  }, [open])

  const resetShow = () => {
    mutate('clear', { except: KEEP })
    setDone('The show is back to its defaults. Your images are untouched.')
  }

  const disconnect = () => {
    leave()
    onClose()
  }

  const fresh = () => {
    rekey()
    onClose()
  }

  /**
   * Everything this machine holds, and then a reload.
   *
   * The order is the whole correctness of it, and it is enforced inside the worker
   * rather than here -- `wipe()` leaves the room, *then* clears the document, then
   * deletes the store it was persisted to. Sequenced from this page it could not be:
   * the document is a CRDT, so clearing it while a provider is still observing would
   * replicate the clearing, and a control that says "reset this machine" would take
   * the show off everybody else's board too.
   *
   * The images are this page's to clear -- their store belongs to the page, not the
   * worker -- and storage is neither's, so both happen out here.
   *
   * The reload is what makes it a reset rather than a clear: the worker holds the
   * sync seam, the clock role and the connection, and none of that is re-read on the
   * fly.
   */
  const resetMachine = async () => {
    try {
      await velcro.wipe()
      await store.clear()
    } catch {
      // Best effort. A blocked or missing IndexedDB should not leave the rest of
      // the reset half-done -- storage and the reload still get somebody unstuck.
    }

    try {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith(LOCAL)) localStorage.removeItem(key)
      }
    } catch {
      // A locked-down profile had nothing stored to begin with.
    }

    // Query and fragment both, or the room in the dock URL rejoins on the way back
    // up and the machine is not reset at all.
    window.location.replace(`${window.location.origin}${window.location.pathname}#/`)
    window.location.reload()
  }

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onCancel={onClose}
      className="ss-reset-dialog m-auto w-[min(34rem,92vw)] rounded-lg border border-slate-800 bg-slate-900 p-0 text-slate-100 backdrop:bg-black/60 open:flex open:flex-col"
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-slate-800 px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Start over</h2>
        <Tooltip label="Close" align="end" className="ml-auto">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
          >
            <Icon name="close" />
          </button>
        </Tooltip>
      </header>

      <div className="flex flex-col gap-3 overflow-y-auto p-4">
        <Row
          title="Reset the show"
          detail="Every name, score, timer and toggle back to its default, on every machine in the room. Your images are kept."
          action={<Confirm onConfirm={resetShow} label="Reset the show" className="ss-reset-show" />}
        />

        {/* Only when there is a room to leave. A button that disconnects a board
            which was never connected is a button that tells an operator they had a
            problem they did not have. */}
        {status.configured ? (
          <Row
            title="Disconnect from collaboration"
            detail="Leave the room and drive this show from this machine alone. Nothing is deleted, and your graphics do not miss a frame. The invite link keeps working if you want to come back."
            action={<Confirm onConfirm={disconnect} label="Disconnect" tone="quiet" className="ss-reset-disconnect" />}
          />
        ) : null}

        {/* Revocation, and the only kind there is. Nobody can be un-told a key they
            already hold, so shutting somebody out means a key they do not have --
            and because the room is derived from the key, minting one moves the show
            somewhere the old link does not point.

            It sat in the invite panel, which was the wrong room: that panel is for
            handing the show to somebody, and the control for taking it away from
            somebody was the loudest thing in it. */}
        {config?.secret ? (
          <Row
            title="Shut somebody out"
            detail="A brand new key, which is a brand new room. Your show comes with you — it lives on this machine, not on a server — and everyone you still want needs the new invite link. Anyone holding the old one is left in a room with nobody in it, which is the point."
            action={<Confirm onConfirm={fresh} label="Start a fresh key" className="ss-reset-rekey" />}
          />
        ) : null}

        <Row
          title="Reset this machine"
          detail="The show, the images, the room, your name — everything this browser has stored — and then a reload. It leaves the room before it wipes anything, so the other machines keep the show; this one comes back as if it had never been used."
          action={<Confirm onConfirm={resetMachine} label="Reset this machine" className="ss-reset-machine" />}
        />

        {done ? <p className="ss-reset-done rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-200">{done}</p> : null}
      </div>
    </dialog>
  )
}

function Row({ title, detail, action }) {
  return (
    <section className="ss-reset-row flex flex-col gap-2 rounded-md border border-slate-800 bg-slate-950/60 p-3">
      <span className="text-sm text-slate-200">{title}</span>
      <span className="text-xs text-slate-500">{detail}</span>
      <span className="self-start pt-0.5">{action}</span>
    </section>
  )
}
