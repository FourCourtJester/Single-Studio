// Import core components
import { useContext } from 'react'
import { Stack, Toast } from 'react-bootstrap'
import { HexAlphaColorPicker, HexColorInput } from 'react-colorful'

// Import our components
import { Context } from '../Context'

// Import style
// ...

export const VariableBackgroundColorPanel = (properties) => {
  // Contexts
  const { fn, backgroundColor: show = false } = useContext(Context)
  // Properties
  const { color } = properties

  const handleClose = (e) => {
    e.preventDefault()

    fn.toggle(e, 'backgroundColor')
  }

  const handleSubmit = (colour) => fn.change(null, { style: { backgroundColor: colour } })

  return (
    <Toast show={show} onClose={handleClose}>
      <Toast.Header className="text-dark py-2 px-3">
        <span className="me-auto">Background Color</span>
      </Toast.Header>
      <Toast.Body className="d-flex flex-column justify-content-center align-items-center p-3">
        <Stack gap={2}>
          <HexAlphaColorPicker className="w-100" color={color} onChange={handleSubmit} />
          <HexColorInput className="form-control form-control-sm bg-light border-1 text-dark text-center ps-0 py-0" color={color} onChange={handleSubmit} />
        </Stack>
      </Toast.Body>
    </Toast>
  )
}
