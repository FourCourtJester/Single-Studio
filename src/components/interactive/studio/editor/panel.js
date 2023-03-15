// Import core components
import { Toast, ToastContainer } from 'react-bootstrap'

// Import our components
import { ColButton, RowButton } from 'components/interactive/studio/editor'

// Import style
// ...

function InteractiveEditorPanel() {
  return (
    <ToastContainer className="position-fixed me-2 mb-2" position="bottom-end">
      <Toast>
        <Toast.Body className="text-dark">
          <ColButton />
          <RowButton className="ms-2" />
        </Toast.Body>
      </Toast>
    </ToastContainer>
  )
}

// Exported Component for use
export default InteractiveEditorPanel
