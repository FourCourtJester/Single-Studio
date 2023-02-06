// Import core components
import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Button, Container, Form, Navbar } from 'react-bootstrap'

// Import our components
// ...

// Import style
// ...

/**
 * Page: Studio
 *
 * @returns {React.FunctionComponentElement} React.FunctionComponentElement
 */
function Studio() {
  // Hooks
  const params = useParams()
  // States
  const [SStudio, setStudio] = useState(false)
  // Refs
  const $btn = useRef(null)
  const $form = useRef(null)

  const handleSubmit = (e) => {
    e.preventDefault()

    console.log([...new URLSearchParams(new FormData($form.current))])
  }

  const handleSubmitKey = useCallback(
    (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSubmit(new SubmitEvent('submit', { submitter: $btn.current }))
      }
    },
    [$btn]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleSubmitKey)
    return () => document.removeEventListener('keydown', handleSubmitKey)
  }, [handleSubmitKey])

  useEffect(() => {
    Promise.resolve(true)
      .then(() => import(`projects/${params.code}/Studio`))
      .then((s) => setStudio({ Component: s.default }))
      .catch((err) => {
        console.error(err)
      })

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (SStudio === false) return null

  return (
    <Form ref={$form} onSubmit={handleSubmit}>
      <Navbar className="border-bottom border-light" fixed="top">
        <Container fluid>
          <Navbar.Brand className="text-light">{SStudio.Component.name}</Navbar.Brand>
          <div className="ms-auto">
            <Button ref={$btn} type="submit">
              <i className="fa fa-floppy-disk" />
            </Button>
          </div>
        </Container>
      </Navbar>
      <Container id="studio" className="h-100" fluid>
        <SStudio.Component.Page />
      </Container>
    </Form>
  )
}

export default Studio
