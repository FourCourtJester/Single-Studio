// Import core components
import { useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { Collapse, Stack, Toast, ToastContainer } from 'react-bootstrap'
import cN from 'classnames'

// Import our components
import { selectInteractive } from 'db/slices/interactive'
import { types } from 'components/interactive/studio'
import { ColButton, RowButton, VariableButton } from 'components/interactive/studio/editor'

import * as Utils from 'toolkits/utils'

// Import style
// ...

export const InteractiveEditorPanel = () => {
  // Redux
  const field = useSelector((state) => selectInteractive(state))
  // States
  const [show, setShow] = useState(false)
  // Variables
  const headerProps = useMemo(
    () => ({
      className: cN(show ? false : 'rounded-2', 'py-2 ps-3 pe-0'),
      closeButton: false,
    }),
    [show]
  )
  const panel = useMemo(() => {
    if (!field || !Object.keys(field).length) return undefined

    const _field = field || {}

    const { type } = _field
    const E = types.panel[Utils.capitalize(type)]

    return <E {..._field} />
  }, [field])

  const handleCollapse = (e) => {
    e.preventDefault()
    setShow((_show) => !_show)
  }

  if (panel) {
    return (
      <ToastContainer className="position-fixed px-2 pb-2" position="bottom-center">
        <Stack gap={1}>{panel}</Stack>
      </ToastContainer>
    )
  }

  return (
    <ToastContainer className="position-fixed px-2 pb-2" position="bottom-center">
      <Stack gap={1}>
        <Toast id="editor">
          <Toast.Header {...headerProps}>
            <span className="me-auto">Editor</span>
            <button className="btn btn-link py-1" type="button" onClick={handleCollapse}>
              <i className={cN('fas', show ? 'fa-chevron-down' : 'fa-chevron-up', 'text-dark')} />
            </button>
          </Toast.Header>
          <Toast.Body className="text-dark p-0">
            <Collapse in={show}>
              <div>
                <Stack className="p-3" direction="horizontal" gap={2}>
                  <RowButton />
                  <ColButton />
                  <span className="text-dark">|</span>
                  <VariableButton />
                </Stack>
              </div>
            </Collapse>
          </Toast.Body>
        </Toast>
      </Stack>
    </ToastContainer>
  )
}
