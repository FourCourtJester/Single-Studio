// Import core components
import { forwardRef } from 'react'
import { Form } from 'react-bootstrap'
import styled from 'styled-components'

// Import our components
// ...

// Styled Form
const StyledForm = styled(Form)`
  input {
    ~ button[type='submit'] {
      display: block;
    }
    ~ button[type='button'] {
      display: none;
    }

    &:invalid {
      ~ button[type='submit'] {
        display: none;
      }
      ~ button[type='button'] {
        display: block;
      }
    }
  }
`

export const _Form = forwardRef((properties, ref) => <StyledForm ref={ref} {...properties} />)

_Form.displayName = 'StyledGateForm'
