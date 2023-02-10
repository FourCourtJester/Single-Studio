// Import core components
import { useCallback, useEffect, useRef, useState } from 'react'
import { useDispatch } from 'react-redux'
import { useParams } from 'react-router-dom'
import { Button, Container, Form, Navbar } from 'react-bootstrap'

// Import our components
import { updateStudio } from 'db/slices/studio'

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
  const dispatch = useDispatch()
  // States
  const [SStudio, setStudio] = useState(false)
  // Refs
  const $btn = useRef(null)
  const $form = useRef(null)

  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault()

      const data = [...new URLSearchParams(new FormData($form.current))]
      const obj = data.reduce((_obj, [key, val]) => ({ ..._obj, [`variables.${key}`]: val }), {})

      console.log(obj)
      dispatch(updateStudio(obj))
    },
    [dispatch]
  )

  const handleSubmitKey = useCallback(
    (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
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

  useEffect(() => {
    Promise.resolve(true)
      .then(() => import(`projects/${params.code}/Studio`))
      .then((s) => setStudio({ Component: s.default }))
      .catch((err) => {
        console.error(err)
      })

    return () => setStudio(false)

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (SStudio === false) return null

  return (
    <>
      <Navbar className="border-bottom border-light" fixed="top">
        <Container fluid>
          <Navbar.Brand className="text-light">{SStudio.Component.name}</Navbar.Brand>
          <div className="ms-auto">
            <Button ref={$btn} variant="info" type="button" onClick={handleSubmit}>
              <i className="fa fa-floppy-disk" />
            </Button>
          </div>
        </Container>
      </Navbar>
      <Form ref={$form} id="studio" className="w-100 h-100" onSubmit={handleSubmit}>
        <Container className="pt-2 h-100" fluid>
          <SStudio.Component.Page />
        </Container>
      </Form>
    </>
  )
}

export default Studio
