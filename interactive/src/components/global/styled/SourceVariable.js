// Import core components
import { forwardRef } from 'react'
import styled from 'styled-components'

// Import our components
import { Variable } from 'components/source'

// Styled Studio
const StyledSourceVariable = styled(Variable)`
  transition: opacity ease 0.5s;
  opacity: 0;

  &.appear-active,
  &.appear-done,
  &.enter-active,
  &.enter-done {
    opacity: 1;
  }
`

export const _SourceVariable = forwardRef((properties, $ref) => <StyledSourceVariable ref={$ref} {...properties} />)

_SourceVariable.displayName = 'StyledSourceVariable'
