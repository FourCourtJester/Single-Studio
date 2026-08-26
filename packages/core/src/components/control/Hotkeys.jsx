import { useEffect, useRef, useState } from 'react'

import { ACTIONS, useHotkeys } from '../../hooks/useHotkeys'
import { chordOf, formatChord, isReserved, problemWith } from '../../toolkits/hotkey'
import { cx } from '../../toolkits/cx'
import { Icon } from '../common/Icon'
import { Tooltip } from '../common/Tooltip'

/**
 * Record one chord.
 *
 * Press-to-set rather than a text box, because a chord typed as text is a chord
 * somebody can spell wrong, and "Ctrl + S" and "ctrl-s" and "^S" all mean the same
 * thing to a person and none of them to a parser. Pressing the keys is also the
 * only way to find out that the browser eats the combination before the page sees
 * it -- a text box would happily accept one that can never fire.
 *
 * Escape leaves recording without changing anything, which is why it is not
 * bindable: it has to mean "get me out of here" while the widget is listening.
 */
function Recorder({ action, chord, onBind }) {
  const [recording, setRecording] = useState(false)
  const [caught, setCaught] = useState(null)
  const button = useRef(null)

  useEffect(() => {
    if (!recording) return undefined

    const onKeyDown = (event) => {
      // Everything, including the browser's own combinations where that is
      // possible. Recording is the one moment the page genuinely wants every key.
      event.preventDefault()
      event.stopPropagation()

      if (event.key === 'Escape') {
        setRecording(false)
        setCaught(null)

        return
      }

      const next = chordOf(event)

      // Null while only modifiers are held: somebody reaching for Ctrl+S is
      // mid-chord, not finished.
      if (!next) return

      setCaught(next)

      if (isReserved(next)) return

      onBind(next)
      setRecording(false)
      setCaught(null)
    }

    // Capture, so the recorder sees the key before anything else on the board acts
    // on it -- otherwise binding a chord that is already bound would fire the
    // action it is currently on while you were trying to move it.
    document.addEventListener('keydown', onKeyDown, true)

    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [recording, onBind])

  const problem = problemWith(recording ? caught : chord)
  const shown = recording ? 'Press a key…' : chord ? formatChord(chord) : 'Not set'

  return (
    <div className="ss-hotkey-row flex items-center gap-3 py-2">
      <span className="grow text-sm text-slate-200">{action.label}</span>

      {chord && !recording ? (
        <Tooltip label={`Clear ${formatChord(chord)}`} align="end">
          <button
            type="button"
            onClick={() => onBind('')}
            aria-label={`Clear the shortcut for ${action.label}`}
            className="ss-hotkey-clear flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-200"
          >
            <Icon name="close" />
          </button>
        </Tooltip>
      ) : null}

      <button
        ref={button}
        type="button"
        onClick={() => {
          setCaught(null)
          setRecording((was) => !was)
        }}
        aria-label={`${chord ? `Change the shortcut for ${action.label}, currently ${formatChord(chord)}` : `Set a shortcut for ${action.label}`}`}
        data-recording={recording ? 'true' : 'false'}
        data-chord={chord || ''}
        className={cx(
          'ss-hotkey-set min-w-28 shrink-0 rounded-md border px-3 py-1.5 text-center font-mono text-xs transition-colors',
          recording
            ? 'border-amber-500 bg-amber-500/10 text-amber-300'
            : chord
              ? 'border-slate-700 bg-slate-800 text-slate-100 hover:border-slate-600'
              : 'border-dashed border-slate-700 text-slate-500 hover:border-slate-600',
        )}
      >
        {shown}
      </button>

      {problem ? (
        <p
          role={problem.level === 'note' ? undefined : 'alert'}
          data-level={problem.level}
          className={cx('ss-hotkey-problem basis-full text-xs', problem.level === 'note' ? 'text-slate-500' : 'text-amber-400')}
        >
          {problem.message}
        </p>
      ) : null}
    </div>
  )
}

/**
 * Rebind the board's keyboard shortcuts.
 *
 * Ctrl+S was the only way to save without reaching for the mouse, and it is not
 * everybody's key -- it collides with habits from other software, and on some
 * layouts it is genuinely awkward. The bindings are the operator's rather than the
 * show's, so changing one here does not move anybody else's -- but they are stored
 * with the studio rather than on the machine, so they travel with an export.
 */
export function Hotkeys({ className, ...rest }) {
  const { bindings, bind, reset } = useHotkeys()

  return (
    <div className={cx('ss-hotkeys flex flex-col', className)} {...rest}>
      <div className="flex flex-col divide-y divide-slate-800">
        {ACTIONS.map((action) => (
          <Recorder key={action.id} action={action} chord={bindings[action.id] ?? ''} onBind={(chord) => bind(action.id, chord)} />
        ))}
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Shortcuts are yours, not part of the show &mdash; nobody else&rsquo;s board moves when you change one. They are stored with the studio, so they come
        with it if you move it to another machine. A chord with no modifier only works while no text field has focus.
      </p>

      <button
        type="button"
        onClick={reset}
        className="ss-hotkey-reset mt-3 self-start rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:bg-slate-800"
      >
        Restore defaults
      </button>
    </div>
  )
}

/** The same panel as a modal, for the menu. */
export function HotkeysDialog({ open, onClose }) {
  const dialog = useRef(null)

  useEffect(() => {
    const element = dialog.current

    if (!element) return

    if (open && !element.open) element.showModal()
    if (!open && element.open) element.close()
  }, [open])

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onCancel={onClose}
      className="ss-hotkeys-dialog m-auto w-[min(32rem,94vw)] max-h-[86vh] rounded-lg border border-slate-800 bg-slate-900 p-0 text-slate-100 backdrop:bg-black/60 open:flex open:flex-col"
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-slate-800 px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Keyboard shortcuts</h2>
        <Tooltip label="Close" align="end" className="ml-auto">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close keyboard shortcuts"
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
          >
            <Icon name="close" />
          </button>
        </Tooltip>
      </header>
      <div className="min-h-0 grow overflow-y-auto p-4">{open ? <Hotkeys /> : null}</div>
    </dialog>
  )
}
