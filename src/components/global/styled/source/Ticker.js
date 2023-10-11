// Import core components
import { forwardRef } from 'react'
import styled, { css, keyframes } from 'styled-components'

// Import our components
// ...

const scrollKeyFrames = keyframes`
  from {
    transform: translateX(var(--ss-animation-translation-start));
  }
  to {
    transform: translateX(-100%);
  }
`

// Styled Ticker
const StyledTicker = styled.span`
  ${(props) => {
    switch (props?.$animation) {
      case 'custom': {
        break
      }

      default: {
        return css`
          --ss-animation-translation-start: ${props.$translationStart};
          animation: ${scrollKeyFrames} linear infinite;

          .ticker.inactive & {
            animation-name: none;
            transform: translateX(${props.$translationStart});
          }

          .toggle.inactive & {
            animation-name: none;
          }
        `
      }
    }
  }}
`

export const _Ticker = forwardRef((properties, ref) => <StyledTicker ref={ref} {...properties} />)

_Ticker.displayName = 'StyledTicker'
