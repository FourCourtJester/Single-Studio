// Import core components
import { useEffect, useState } from 'react'
import { Button, Col, FloatingLabel, Form, Row } from 'react-bootstrap'

// Import our components
import { useStudio } from 'hooks'
import { Variable } from 'components/studio'
import * as Utils from 'toolkits/utils'
import { ToolTip } from 'components/global'

// Import style
// ...

const namespace = 'variables'
const defaults = {
  fields: ['name', 'score'],
}

export const Leaderboard = (properties) => {
  // Properties
  const { delimiter = '\t', fields, label = 'Leaderboard', name } = properties
  // Redux
  const val = useStudio(`${namespace}.${name}`) || null
  // States
  const [isText, setView] = useState(true)
  const [entries, setEntries] = useState([])
  const [transform, setTransform] = useState([])

  const handleUpdate = (e, key, i) => {
    const _entries = [...entries]

    _entries[i][key] = e.target.value

    setEntries(_entries)
  }

  const handleView = (e) => {
    e.preventDefault()

    setView((_view) => !_view)
  }

  useEffect(() => {
    setEntries(
      !val || !val.length
        ? []
        : val.split('\n').map((entry) => {
            const parts = entry.split(delimiter)
            return (fields || defaults.fields).reduce((obj, field, i) => ({ ...obj, [field]: parts[i] }), {})
          })
    )
  }, [delimiter, fields, val])

  useEffect(() => {
    setTransform(entries.map((entry) => Object.values(entry).join(delimiter)).join('\n'))
  }, [delimiter, entries])

  return (
    <>
      <Row>
        <Col>
          <legend>{label}</legend>
        </Col>
        <Col xs="auto">
          <ToolTip placement="left" tooltip={<>Swap leaderboard</>}>
            <Button className="text-dark" variant="warning" onClick={handleView}>
              {isText ? <i className="fas fa-list" /> : <i className="fas fa-code" />}
            </Button>
          </ToolTip>
        </Col>
      </Row>
      {isText ? (
        <Row>
          <Col>
            <Variable as="textarea" {...properties} />
          </Col>
        </Row>
      ) : (
        <Row>
          <Col>
            {entries.map((field, i) => (
              <Row key={i}>
                {Object.entries(field).map(([key, v], j) => (
                  <Col key={j}>
                    <FloatingLabel
                      label={`${Utils.ordinal(i + 1)} Place ${Utils.capitalize(key)}`}
                      controlId={name + key + i + j}
                      onChange={(e) => handleUpdate(e, key, i)}
                    >
                      <Form.Control
                        placeholder={`${Utils.ordinal(i + 1)} Place ${Utils.capitalize(key)}`}
                        defaultValue={v}
                        onChange={(e) => handleUpdate(e, key, i)}
                      />
                    </FloatingLabel>
                  </Col>
                ))}
              </Row>
            ))}
          </Col>
          <input type="hidden" name={`${namespace}.${name}`} value={transform} />
        </Row>
      )}
    </>
  )
}
