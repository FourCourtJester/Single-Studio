// Import core components
import { forwardRef } from 'react'
import styled from 'styled-components'

// Import our components
import { Button } from '.'

const variants = ['obs', 'outline-obs']

// Styled Button
const StyledButton = styled(Button)`
  --bs-btn-focus-shadow-rgb: none;
`

export const _Button = forwardRef((properties, ref) => (
  <StyledButton ref={ref} {...properties} variant={variants.includes(properties.variant) ? properties.variant : 'obs'} />
))

_Button.displayName = 'StyledOBSButton'
