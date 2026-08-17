import { useEffect } from 'react'

import { useDraft } from '../../studio/DraftProvider'
import * as Draft from '../../studio/draft'
import { cx } from '../../toolkits/cx'

const isMac = () => typeof navigator !== 'undefined' && /Mac|iP(hone|ad|od)/.test(navigator.platform || navigator.userAgent)

/**
 * Commits every staged edit at once, and owns the Ctrl/Cmd+S binding.
 *
 * The shortcut is registered here rather than in the provider so it is only live
 * where a save is meaningful -- a graphic page has nothing to commit and should not
 * be swallowing the browser's own Ctrl+S.
 */
export function SaveButton({ className, ...rest }) {
  const { draft, save, revert } = useDraft()
  const pending = Draft.count(draft)

  useEffect(() => {
    const onKeyDown = (event) => {
      const chord = event.ctrlKey || event.metaKey

      if (chord && event.key.toLowerCase() === 's') {
        // Always prevent the browser's own save dialog, even with nothing pending:
        // an operator hitting the shortcut out of habit should never get a file
        // picker over the top of their board.
        event.preventDefault()
        save()
      }
    }

    document.addEventListener('keydown', onKeyDown)

    return () => document.removeEventListener('keydown', onKeyDown)
  }, [save])

  return (
    <div className={cx('ss-save flex items-center gap-2', className)} {...rest}>
      {pending ? (
        <button
          type="button"
          onClick={() => revert()}
          title="Discard all unsaved changes"
          className="rounded-md px-2 py-1 text-xs text-slate-400 transition-colors hover:text-slate-200"
        >
          Discard
        </button>
      ) : null}
      <button
        type="button"
        onClick={save}
        disabled={!pending}
        title={`Save changes (${isMac() ? '⌘' : 'Ctrl'}+S)`}
        aria-keyshortcuts={isMac() ? 'Meta+S' : 'Control+S'}
        className={cx(
          'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
          pending ? 'bg-amber-500 text-slate-950 hover:bg-amber-400' : 'cursor-default border border-slate-800 text-slate-600',
        )}
      >
        {pending ? `Save ${pending} change${pending === 1 ? '' : 's'}` : 'Saved'}
      </button>
    </div>
  )
}
