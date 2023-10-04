// Import core components
import { forwardRef } from 'react'
import styled from 'styled-components'

// Import our components
// ...

// Styled Variable
const StyledVariable = styled.var`
  font-style: normal;

  ${(props) => {
    switch (props?.$animation) {
      case 'custom':
      case 'cut': {
        break
      }

      default: {
        return `
          transition: opacity ease 0.5s;
          opacity: 1;

          &.exiting,
          &.inactive {
            opacity: 0;
          }
        `
      }
    }
  }}
`

export const _Variable = forwardRef((properties, ref) => <StyledVariable ref={ref} {...properties} />)

_Variable.displayName = 'StyledVariable'
