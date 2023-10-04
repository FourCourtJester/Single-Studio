// Import core components
import { forwardRef } from 'react'
import { Image } from 'react-bootstrap'
import styled from 'styled-components'

// Import our components
// ...

// Styled Image
const StyledImage = styled(Image)`
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

export const _Image = forwardRef((properties, ref) => <StyledImage ref={ref} {...properties} />)

_Image.displayName = 'StyledImage'
