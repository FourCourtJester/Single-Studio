// Import core components
import { forwardRef } from 'react'
import { Button } from 'react-bootstrap'
import styled from 'styled-components'

// Import our components
// ...

// Styled Button
const StyledButton = styled(Button)`
  cursor: pointer;

  .await {
    display: none;
  }

  &:disabled,
  &.disabled {
    .await {
      display: inline-block;

      & + i {
        display: none;
      }
    }
  }

  &.no-cursor {
    cursor: auto;
  }

  &:focus {
    box-shadow: none;
  }
`

export const _Button = forwardRef((properties, ref) => <StyledButton ref={ref} {...properties} />)

_Button.displayName = 'StyledButton'
