// Import core components
import { forwardRef } from 'react'
import styled from 'styled-components'

// Import our components
// ...

// Styled Timer
const StyledTimer = styled.time`
  font-style: normal;
`

export const _Timer = forwardRef((properties, ref) => <StyledTimer ref={ref} {...properties} />)

_Timer.displayName = 'StyledTimer'
