// -- React Router DOM v6 Route
// Import core components
import { useCallback, useEffect, useRef } from 'react'
import { useDispatch } from 'react-redux'
import { useLoaderData, useParams, useRouteError } from 'react-router-dom'
import { Button, Container, Form, Navbar, OverlayTrigger, Tooltip } from 'react-bootstrap'

// Import our components
import { updateStudio } from 'db/slices/studio'
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
  const { default: Studio } = useLoaderData()
  // Refs
  const $btn = useRef(null)
  const $form = useRef(null)

  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault()

      const data = [...new URLSearchParams(new FormData($form.current))]
      const obj = data.reduce((_obj, [key, val]) => ({ ..._obj, [`${params.code}.${key}`]: val }), {})

      // console.log(obj)
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

  useEffect(() => {
    document.addEventListener('keydown', handleSubmitKey)
    return () => document.removeEventListener('keydown', handleSubmitKey)
  }, [handleSubmitKey])

  return (
    <>
      <Navbar className="border-bottom border-light" fixed="top">
        <Container fluid>
          <Navbar.Brand className="text-light">{Studio.name}</Navbar.Brand>
          <div className="ms-auto">
            <OverlayTrigger placement="left" overlay={<Tooltip>Save</Tooltip>}>
              <Button ref={$btn} variant="obs" type="button" onClick={handleSubmit}>
                <i className="fa fa-floppy-disk" />
              </Button>
            </OverlayTrigger>
          </div>
        </Container>
      </Navbar>
      <Form ref={$form} id="studio" className="w-100 h-100" onSubmit={handleSubmit}>
        <Container className="py-2 mh-100 overflow-x-hidden overflow-y-auto" fluid>
          <Studio.Page />
        </Container>
      </Form>
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
