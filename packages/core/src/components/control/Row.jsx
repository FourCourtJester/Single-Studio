import { Children, createContext, useCallback, useContext, useLayoutEffect, useState } from 'react'

import { cx } from '../../toolkits/cx'

/**
 * How a labelled control tells the Row it sits in that the row has a label line.
 *
 * A switch or a button has no label, so in a row beside a text field it would line up
 * with the field's label instead of its input. It is pushed down by the height of a
 * label line to fix that -- but only when something in the row has one. A row of
 * nothing but switches pushed down would just be a gap at the top of it.
 *
 * Counted from the labels themselves rather than guessed from the Row's children,
 * because a studio wraps controls in components of its own, and a Row looking at its
 * children sees the wrapper, not the label inside it.
 */
const RowLabels = createContext(null)

/** Tell the enclosing Row, if there is one, that this control draws a label line. */
export function useRowLabel(present = true) {
  const claim = useContext(RowLabels)

  // Layout rather than passive, so the row has its label line before the first
  // paint instead of the switches beside it visibly dropping a frame later.
  useLayoutEffect(() => (present && claim ? claim() : undefined), [claim, present])
}

/**
 * @typedef {object} RowProps
 * @property {import("react").ReactNode} [children] - Controls. Each takes the whole row in a narrow dock and an equal share of it once there is room; give one a `col-span-*` class to set its width out of 12.
 * @property {string} [className] - Added to the component's own classes.
 */
/**
 * A line of controls inside a `Panel`: stacked one above the other in a slim OBS
 * dock, side by side once the board is wider than 768px.
 *
 * It is a twelve-column grid, so widths are counted in twelfths, the way Bootstrap's
 * `col-md-*` counts them. Left alone, the controls share the row equally. To size
 * one, give it Tailwind's `col-span-*`: unprefixed, it applies at every width; with
 * a breakpoint (`md:col-span-8`) only from there up, stacking below it. The equal
 * share is worked out from how many controls there are, not from what is left over,
 * so size one and you size them all: a 6 beside two unsized controls is 6, 4 and 4,
 * and the last one wraps.
 *
 * Controls line up along their inputs rather than their tops. Every control on the
 * board is a label, then one input line of the same height, then anything extra --
 * colour presets, a warning -- hanging below where it cannot push its neighbours
 * out of line. A switch or button beside a labelled control drops by one label's
 * height so it sits level with the inputs. A control of your own that should do the
 * same takes the `ss-unlabelled` class.
 *
 * The input line is `--ss-input-h` tall, 2.5rem unless a studio sets it.
 *
 * @example
 * <Panel title="Home">
 *   <Row>
 *     <Field name="home.name" label="Team" className="md:col-span-6" />
 *     <Stepper name="home.score" label="Score" className="md:col-span-3" />
 *     <Toggle name="home" label="home" className="md:col-span-3" />
 *   </Row>
 * </Panel>
 *
 * @param {RowProps & import("react").HTMLAttributes<HTMLElement>} props
 */
export function Row({ children, className, style, ...rest }) {
  const [labels, setLabels] = useState(0)
  const claim = useCallback(() => {
    setLabels((count) => count + 1)
    return () => setLabels((count) => count - 1)
  }, [])

  // An equal share of twelve, and the columns left over when twelve does not divide.
  // Five controls are 3, 3, 2, 2, 2 rather than five 2s with a gap at the end: the
  // first few take one more each, which the stylesheet does from `data-spare`.
  const count = Children.toArray(children).length || 1
  const share = Math.max(1, Math.floor(12 / count))
  const spare = count < 12 ? 12 - share * count : 0

  return (
    <RowLabels.Provider value={claim}>
      <div
        className={cx('ss-row', className)}
        data-labelled={labels > 0 ? '' : undefined}
        data-spare={spare || undefined}
        style={{ '--ss-share': share, '--ss-share-more': share + 1, ...style }}
        {...rest}
      >
        {children}
      </div>
    </RowLabels.Provider>
  )
}
