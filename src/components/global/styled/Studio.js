// Import core components
import { forwardRef } from 'react'
import { Form } from 'react-bootstrap'
import styled from 'styled-components'

// Import our components
// ...

// Styled Studio
const StyledStudio = styled(Form)`
  padding-top: 3.75rem;
`

export const _Studio = forwardRef((properties, ref) => <StyledStudio ref={ref} {...properties} />)

_Studio.displayName = 'StyledStudio'
