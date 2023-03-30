// Import core components
import { useSelector } from 'react-redux'
import { Collapse, Stack, Toast, ToastContainer } from 'react-bootstrap'

// Import our components
import { selectInteractive } from 'db/slices/interactive'
import { types } from 'components/interactive/studio'
import { ColButton, RowButton, VariableButton } from 'components/interactive/studio/editor'
import * as Utils from 'toolkits/utils'
import { useState } from 'react'
import classNames from 'classnames'

// Import style
// ...

export const InteractiveEditorPanel = () => {
  // Redux
  const field = useSelector((state) => selectInteractive(state)) || {}
  // States
  const [show, setShow] = useState(true)

  const handleCollapse = (e) => {
    e.preventDefault()
    setShow((_show) => !_show)
  }

  const render = () => {
    const { type } = field
    const E = types.panel[Utils.capitalize(type)]

    return <E {...field} />
  }

  return (
    <ToastContainer className="position-fixed me-2 mb-2" position="bottom-end">
      <Stack gap={1}>
        {field.id ? (
          render()
        ) : (
          <Toast id="editor">
            <Toast.Header className="py-2 px-3" closeButton={false}>
              <span className="me-auto">Editor</span>
              <button className="btn btn-link" type="button" onClick={handleCollapse}>
                <i className={classNames('fas', show ? 'fa-chevron-down' : 'fa-chevron-up', 'text-dark')} />
              </button>
            </Toast.Header>
            <Toast.Body className="text-dark p-0">
              <Collapse in={show}>
                <div>
                  <div className="p-3">
                    <h6 className="border-bottom border-dark mb-2">Structures</h6>
                    <Stack direction="horizontal" gap={2}>
                      <RowButton />
                      <ColButton />
                    </Stack>
                    <h6 className="border-bottom border-dark my-2">Fields</h6>
                    <Stack direction="horizontal" gap={2}>
                      <VariableButton />
                    </Stack>
                  </div>
                </div>
              </Collapse>
            </Toast.Body>
          </Toast>
        )}
      </Stack>
    </ToastContainer>
  )
}
