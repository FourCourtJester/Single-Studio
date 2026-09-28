import { useMutationFailure } from '../../hooks/useVelcroMutate'
import { Icon } from '../common/Icon'
import { Tooltip } from '../common/Tooltip'

/**
 * A button that did nothing, and why.
 *
 * Before this, a mutation that threw failed in the worker's console, and the
 * operator's experience of it was a button that stopped working in the middle of a
 * show. There is no way to tell that apart from a mis-click, so the natural thing
 * is to press it again -- and again. Saying which action failed and that nothing
 * changed turns that into a decision: carry on by hand, or call whoever wrote the
 * studio.
 *
 * "Nothing changed" is a promise, not reassurance. A mutation happens completely
 * or not at all (see "Staging" in velcro/mutations.js), so there is no half-state
 * on air to go looking for.
 *
 * Stays until dismissed. A notice that fades on a timer is one the operator was
 * looking at the program monitor for.
 */
export function MutationTrouble() {
  const [failure, dismiss] = useMutationFailure()

  if (!failure) return null

  return (
    <div
      role="alert"
      className="ss-mutation-trouble flex items-start gap-2 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200"
    >
      <p className="min-w-0 grow">
        <strong className="font-medium text-rose-100">
          <code className="ss-mutation-name font-mono">{failure.name}</code> did not go through.
        </strong>{' '}
        Nothing was changed, on air or anywhere else.
        {failure.count > 1 ? <span className="ss-mutation-count"> ({failure.count} times)</span> : null}{' '}
        <span className="ss-mutation-reason text-rose-300/90">{failure.message}</span>
      </p>
      <Tooltip label="Dismiss" align="end" className="shrink-0">
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="ss-mutation-dismiss flex h-6 w-6 items-center justify-center rounded-md text-rose-300 transition-colors hover:bg-rose-500/20 hover:text-rose-100"
        >
          <Icon name="close" />
        </button>
      </Tooltip>
    </div>
  )
}
