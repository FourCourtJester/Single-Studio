// Import core components
import { forwardRef } from 'react'
import { DropdownButton } from 'react-bootstrap'
import styled from 'styled-components'

// Import our components
// ...

// Styled Dropdown
const StyledDropdown = styled(DropdownButton)`
  .dropdown-menu {
    min-width: unset;
  }
`

export const _Dropdown = forwardRef((properties, ref) => <StyledDropdown ref={ref} {...properties} />)

_Dropdown.displayName = 'StyledDropdown'
