// Import core components
import { useSelector } from 'react-redux'
import { Stack, Toast, ToastContainer } from 'react-bootstrap'

// Import our components
import { selectInteractive } from 'db/slices/interactive'
import { types } from 'components/interactive/studio'
import { ColButton, RowButton, VariableButton } from 'components/interactive/studio/editor'
import * as Utils from 'toolkits/utils'

// Import style
// ...

export const InteractiveEditorPanel = () => {
  const field = useSelector((state) => selectInteractive(state))

  const render = () => {
    const { type } = field
    const E = types.panel[Utils.capitalize(type)]

    return <E {...field} />
  }

  return (
    <ToastContainer className="position-fixed me-2 mb-2" position="bottom-end">
      <Stack gap={1}>
        <Toast id="editor">
          <Toast.Body className="text-dark">
            <Stack direction="horizontal" gap={2}>
              <ColButton />
              <RowButton />
              <VariableButton />
            </Stack>
          </Toast.Body>
        </Toast>
        {field.id !== undefined && render()}
      </Stack>
    </ToastContainer>
  )
}
