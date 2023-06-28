// -- React Router DOM v6 Route
// Import core components
import { useCallback, useEffect, useRef } from 'react'
import { useDispatch } from 'react-redux'
import { useLoaderData, useNavigate, useParams, useRouteError } from 'react-router-dom'
import { Button, Container, NavbarBrand } from 'react-bootstrap'

// Import our components
import { ToolTip } from 'components/global'
import { Studio as SStudio, Navbar } from 'components/global/styled'
import { updateStudio } from 'db/slices/studio'
// import { useOBS } from 'hooks'
import { P404 } from 'pages'

// Import style
// ...

export function loader({ params }) {
  return import(`studios/${params.code}/Studio`)
}

export function ErrorBoundary() {
  const error = useRouteError()
  return <P404 error={error} />
}

export function Component() {
  // Hooks
  const params = useParams()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { name, Studio } = useLoaderData()
  // const OBS = useOBS({ toasts: true })
  // Refs
  const $btn = useRef(null)
  const $form = useRef(null)

  // const handleOBS = () => {
  //   OBS.call('GetCurrentProgramScene')
  //     .then((response) => OBS.call('GetSceneItemList', { sceneName: response.currentProgramSceneName }))
  //     .then((response) => console.log(response))
  // }

  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault()

      const data = [...new URLSearchParams(new FormData($form.current))]
      const obj = data.reduce((_obj, [key, val]) => ({ ..._obj, [`${params.code}.${key}`]: val }), {})

      dispatch(updateStudio(obj))
    },
    [dispatch, params]
  )

  const handleSubmitKey = useCallback(
    (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        handleSubmit(new SubmitEvent('submit', { submitter: $btn.current }))
      }
    },
    [$btn, handleSubmit]
  )

  const handleReturn = () => navigate(`/`)

  useEffect(() => {
    document.addEventListener('keydown', handleSubmitKey)
    return () => document.removeEventListener('keydown', handleSubmitKey)
  }, [handleSubmitKey])

  // useEffect(() => {
  //   const eventID = OBS.on('CurrentProgramSceneChanged', (data) => console.log(data))
  //   return () => OBS.off(eventID)
  // }, [OBS])

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
            {/* <Button className="ms-2" variant="primary" type="button" onClick={handleOBS}>
              <i className="fa fa-close" />
            </Button> */}
          </div>
        </Container>
      </Navbar>
      <SStudio ref={$form} id="studio" className="w-100 h-100" onSubmit={handleSubmit}>
        <Container className="py-2 h-100 overflow-x-hidden overflow-y-auto" fluid>
          <Studio />
        </Container>
      </SStudio>
      {/* <Modal size="xl" show scrollable>
        <Modal.Header closeButton>
          <Modal.Title className="text-dark">Configuration</Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-dark text-center">Configuration Options here</Modal.Body>
      </Modal> */}
    </>
  )
}

export default {
  loader,
  ErrorBoundary,
  Component,
}

Component.displayName = 'Studio'
ErrorBoundary.displayName = 'StudioErrorBoundary'
