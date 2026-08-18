import { useEffect } from 'react'

import { useDraft } from '../../studio/DraftProvider'
import * as Draft from '../../studio/draft'
import { cx } from '../../toolkits/cx'
import { Icon } from '../common/Icon'
import { Tooltip } from '../common/Tooltip'

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
 * words of similar length never did. The count of pending changes moves into the
 * tooltip, where it costs no width at all -- the dirty dots on the fields say
 * *which* edits are waiting, and the tooltip says how many.
 */
export function SaveButton({ className, ...rest }) {
  const { draft, save, revert } = useDraft()
  const count = Draft.count(draft)
  const pending = count > 0

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
        <Tooltip label="Discard unsaved changes" align="end">
          <button
            type="button"
            onClick={() => revert()}
            aria-label="Discard all unsaved changes"
            className={cx(button, 'ss-discard bg-rose-600 text-white hover:bg-rose-500')}
          >
            <Icon name="close" />
          </button>
        </Tooltip>
      ) : null}
      <Tooltip label={pending ? `Save ${count} change${count === 1 ? '' : 's'} (${isMac() ? '⌘' : 'Ctrl'}+S)` : 'Saved'} align="end">
        <button
          type="button"
          onClick={save}
          disabled={!pending}
          data-pending={pending ? 'true' : 'false'}
          aria-label={pending ? `Save ${count} change${count === 1 ? '' : 's'}` : 'Saved'}
          aria-keyshortcuts={isMac() ? 'Meta+S' : 'Control+S'}
          className={cx(button, pending ? 'bg-amber-500 text-slate-950 hover:bg-amber-400' : 'cursor-default border border-slate-800 text-slate-700')}
        >
          <Icon name="save" />
        </button>
      </Tooltip>
    </div>
  )
}
