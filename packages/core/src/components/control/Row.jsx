import { createContext, useCallback, useContext, useLayoutEffect, useState } from 'react'

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
 * @property {import("react").ReactNode} [children] - Controls. Each takes the whole row in a narrow dock and an equal share of it once there is room; size them with `row-cols-*` on the Row or `col-*` on a control.
 * @property {string} [className] - Added to the component's own classes. `row-cols-*` goes here.
 */
/**
 * A line of controls inside a `Panel`: stacked one above the other in a slim OBS
 * dock, side by side once the board is wider than 768px.
 *
 * Sized the way Bootstrap sizes a row, with Tailwind's breakpoints:
 *
 * - **Left alone**, the controls share the line equally from 768px up.
 * - **`row-cols-*` on the Row** sets how many go on a line, at whatever breakpoints
 *   you give it: `sm:row-cols-2 lg:row-cols-4` is one to a line in a slim dock, two
 *   from 640px, four from 1024px. A line that does not fill has no hole at the end:
 *   the last control on it takes the room.
 * - **`col-span-*` on a control** sets its width out of twelve, the way
 *   Bootstrap's `col-*` does: `md:col-span-8` is two thirds from 768px up.
 * - **`col-auto` on a control** sizes it to its content, and the controls beside it
 *   share what is left. A stepper is 160px wide however wide its share would be;
 *   `lg:col-auto` gives the rest of its line that room instead of leaving it empty.
 *
 * Unprefixed, a class holds at every width; with a breakpoint, from there up.
 *
 * Controls line up along their inputs rather than their tops. Every control on the
 * board is a label, then one input line of the same height, then anything extra --
 * colour presets, a warning -- hanging below where it cannot push its neighbours
 * out of line. A switch or button beside a labelled control drops by one label's
 * height so it sits level with the inputs. A control of your own that should do the
 * same takes the `ss-unlabelled` class.
 *
 * The input line is `--ss-input-h` tall, 2.5rem unless a studio sets it, and the
 * gap between controls `--ss-row-gap`, 0.75rem.
 *
 * @example
 * // One to a line in a dock, two from 640px, all four from 1024px with the
 * // score at its own width.
 * <Row className="sm:row-cols-2 lg:row-cols-4">
 *   <Field name="home.name" label="Team" />
 *   <ImagePicker name="home.logo" label="Logo" />
 *   <Stepper name="home.score" label="Score" className="lg:col-auto" />
 *   <ColorPicker name="home.color" label="Colour" />
 * </Row>
 *
 * @example
 * // Two thirds and a third, from 768px up.
 * <Row>
 *   <Field name="standings.title" label="Heading" className="md:col-span-8" />
 *   <Toggle name="standings" label="standings" className="md:col-span-4" />
 * </Row>
 *
 * @param {RowProps & import("react").HTMLAttributes<HTMLElement>} props
 */
export function Row({ children, className, ...rest }) {
  const [labels, setLabels] = useState(0)
  const claim = useCallback(() => {
    setLabels((count) => count + 1)
    return () => setLabels((count) => count - 1)
  }, [])

  return (
    <RowLabels.Provider value={claim}>
      <div className={cx('ss-row', className)} data-labelled={labels > 0 ? '' : undefined} {...rest}>
        {children}
      </div>
    </RowLabels.Provider>
  )
}
