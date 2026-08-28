import { useHotkeyHandlers, useHotkeys } from '../../hooks/useHotkeys'
import { useDraft } from '../../studio/DraftProvider'
import * as Draft from '../../studio/draft'
import { cx } from '../../toolkits/cx'
import { ariaChord, formatChord } from '../../toolkits/hotkey'
import { Icon } from '../common/Icon'
import { Tooltip } from '../common/Tooltip'

/**
 * @typedef {object} SaveButtonProps
 * @property {string} [className] - Added to the component's own classes.
 */
/**
 * Commits every staged edit at once, and hosts the save and discard shortcuts.
 *
 * They are registered here rather than in the provider so they are only live where
 * a save is meaningful -- a graphic page has nothing to commit and should not be
 * swallowing the browser's own Ctrl+S. Which chord runs which is the operator's,
 * set in the menu under Keyboard shortcuts; this component asks what it is rather
 * than deciding.
 *
 * Both buttons are icons, matched in size and weight, because this pair sits in the
 * board's header where space is scarce and it gets used on the clock. Amber commits,
 * red discards; colour and shape read at a glance from across a desk in a way two
 * words of similar length never did. The count of pending changes moves into the
 * tooltip, where it costs no width at all -- the dirty dots on the fields say
 * *which* edits are waiting, and the tooltip says how many.
 *
 * @param {SaveButtonProps & import("react").HTMLAttributes<HTMLElement>} props
 */
export function SaveButton({ className, ...rest }) {
  const { draft, save, revert } = useDraft()
  const count = Draft.count(draft)
  const pending = count > 0

  const { chordFor } = useHotkeys()
  const saveChord = chordFor('save')

  // Bound whether or not anything is pending. An operator hitting their save key out
  // of habit on a clean board should get nothing -- not the browser's file picker
  // over the top of the show.
  useHotkeyHandlers({ save, discard: () => revert() })

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
      <Tooltip label={pending ? `Save ${count} change${count === 1 ? '' : 's'}${saveChord ? ` (${formatChord(saveChord)})` : ''}` : 'Saved'} align="end">
        <button
          type="button"
          onClick={save}
          disabled={!pending}
          data-pending={pending ? 'true' : 'false'}
          aria-label={pending ? `Save ${count} change${count === 1 ? '' : 's'}` : 'Saved'}
          aria-keyshortcuts={ariaChord(saveChord)}
          className={cx(
            button,
            'ss-save-button',
            pending ? 'bg-amber-500 text-slate-950 hover:bg-amber-400' : 'cursor-default border border-slate-800 text-slate-700',
          )}
        >
          <Icon name="save" />
        </button>
      </Tooltip>
    </div>
  )
}
