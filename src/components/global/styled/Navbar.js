// Import core components
import { forwardRef } from 'react'
import { Navbar } from 'react-bootstrap'
import styled from 'styled-components'

// Import our components
// ...

// Styled Navbar
const StyledNavbar = styled(Navbar)`
  height: 3.75rem;
`

export const _Navbar = forwardRef((properties, ref) => <StyledNavbar ref={ref} {...properties} />)

_Navbar.displayName = 'StyledNavbar'
