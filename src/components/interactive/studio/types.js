// Import our Components
import { Col, Row, Variable } from './components'
import { VariablePanel } from './editor'

const drag = {
  BUTTON: {
    COLUMN: 'button col',
    ROW: 'button row',
    VARIABLE: 'button variable',
  },
  COLUMN: 'col',
  ROW: 'row',
  IMAGE: 'image',
  TIMER: 'timer',
  VARIABLE: 'variable',
}

const tag = {
  Col,
  Row,
  Variable,
}

const panel = {
  Variable: VariablePanel,
}

export const types = {
  drag,
  panel,
  tag,
}
