import { useEffect } from 'react'

import { useDraft } from '../../studio/DraftProvider'
import * as Draft from '../../studio/draft'
import { cx } from '../../toolkits/cx'
import { Icon } from '../common/Icon'

const isMac = () => typeof navigator !== 'undefined' && /Mac|iP(hone|ad|od)/.test(navigator.platform || navigator.userAgent)

/**
 * Commits every staged edit at once, and owns the Ctrl/Cmd+S binding.
 *
 * The shortcut is registered here rather than in the provider so it is only live
 * where a save is meaningful -- a graphic page has nothing to commit and should not
 * be swallowing the browser's own Ctrl+S.
 *
 * Both buttons are icons, matched in size and weight, because this pair sits in the
 * board's header where space is scarce and it gets used on the clock. Amber commits,
 * red discards; colour and shape read at a glance from across a desk in a way two
 * words of similar length never did. The count of pending changes is gone with them -- the
 * dirty dots on the fields themselves say which, which is the useful half, and a
 * number that only ever meant "something" was costing a word to say nothing.
 */
export function SaveButton({ className, ...rest }) {
  const { draft, save, revert } = useDraft()
  const pending = Draft.count(draft) > 0

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

  const button = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors'

  return (
    <div className={cx('ss-save flex shrink-0 items-center gap-2', className)} {...rest}>
      {pending ? (
        <button
          type="button"
          onClick={() => revert()}
          aria-label="Discard all unsaved changes"
          title="Discard all unsaved changes"
          className={cx(button, 'ss-discard bg-rose-600 text-white hover:bg-rose-500')}
        >
          <Icon name="close" />
        </button>
      ) : null}
      <button
        type="button"
        onClick={save}
        disabled={!pending}
        data-pending={pending ? 'true' : 'false'}
        aria-label={pending ? 'Save changes' : 'Saved'}
        title={pending ? `Save changes (${isMac() ? '⌘' : 'Ctrl'}+S)` : 'Saved'}
        aria-keyshortcuts={isMac() ? 'Meta+S' : 'Control+S'}
        className={cx(button, pending ? 'bg-amber-500 text-slate-950 hover:bg-amber-400' : 'cursor-default border border-slate-800 text-slate-700')}
      >
        <Icon name="save" />
      </button>
    </div>
  )
}
