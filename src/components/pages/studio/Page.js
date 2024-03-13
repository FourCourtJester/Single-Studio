// Import core components
import { useCallback, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Container, NavbarBrand } from 'react-bootstrap'

// Import our components
import { ToolTip } from 'components/global'
import { Studio, Navbar } from 'components/global/styled'
import { useEffectOnce, usePageTitle, useVelcro } from 'hooks'

// Import style
// ...

export function Page(properties) {
  // Properties
  const { children, name } = properties
  // Hooks
  const params = useParams()
  const navigate = useNavigate()
  const velcro = useVelcro()
  // Refs
  const $btn = useRef(null)
  const $form = useRef(null)

  usePageTitle(name, 'Studio')

  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault()

      const data = [...new URLSearchParams(new FormData($form.current))]
      const obj = data.reduce((_obj, [key, val]) => ({ ..._obj, [key]: val }), {})

      velcro.action('update', obj)
    },
    [velcro],
  )

  const handleSubmitKey = useCallback(
    (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        handleSubmit(new SubmitEvent('submit', { submitter: $btn.current }))
      }
    },
    [$btn, handleSubmit],
  )

  const handleReturn = () => navigate(`/`)

  useEffect(() => {
    document.addEventListener('keydown', handleSubmitKey)
    return () => document.removeEventListener('keydown', handleSubmitKey)
  }, [handleSubmitKey])

  useEffectOnce(() => {
    velcro.connect(params.code)
  })

  return (
    <>
      <Navbar className="bg-body border-bottom border-light text-nowrap overflow-hidden" fixed="top">
        <Container fluid>
          <NavbarBrand className="me-2">
            <Button variant="obs" type="button" onClick={handleReturn}>
              <i className="fa fa-chevron-left" />
            </Button>
          </NavbarBrand>
          <NavbarBrand className="text-light">{name}</NavbarBrand>
          <div className="ms-auto">
            <ToolTip placement="left" tooltip={<>Save</>}>
              <Button ref={$btn} variant="obs" type="button" onClick={handleSubmit}>
                <i className="fa fa-floppy-disk" />
              </Button>
            </ToolTip>
          </div>
        </Container>
      </Navbar>
      <Studio ref={$form} id="studio" className="w-100 h-100" onSubmit={handleSubmit}>
        <Container className="py-2 h-100 scrollbar" fluid>
          {children}
        </Container>
      </Studio>
      {/* <Modal size="xl" show scrollable>
        <Modal.Header closeButton>
          <Modal.Title className="text-dark">Configuration</Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-dark text-center">Configuration Options here</Modal.Body>
      </Modal> */}
    </>
  )
}
