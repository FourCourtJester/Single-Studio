/**
 * @typedef {object} BreakProps
 * @property {string} [className] - Ignored. Kept so existing boards still compile.
 */
/**
 * Draws nothing. Kept so a board written for 0.9 still builds.
 *
 * It forced a line break when `Panel` laid its controls out in one wrapping line.
 * A Panel now gives every child a row of its own, so the break it made is the
 * default, and controls that should share a line go in a `Row` instead.
 *
 * @deprecated Since 0.10. Delete it; put controls that share a line in a `Row`.
 *
 * @example
 * // Before
 * <Panel title="Scores">
 *   <Stepper name="home.score" label="Home" />
 *   <Stepper name="away.score" label="Away" />
 *   <Break />
 *   <Select name="period" options={PERIODS} />
 * </Panel>
 *
 * // After
 * <Panel title="Scores">
 *   <Row>
 *     <Stepper name="home.score" label="Home" />
 *     <Stepper name="away.score" label="Away" />
 *   </Row>
 *   <Select name="period" options={PERIODS} />
 * </Panel>
 *
 * @param {BreakProps} _props
 */
export function Break(_props) {
  return null
}
