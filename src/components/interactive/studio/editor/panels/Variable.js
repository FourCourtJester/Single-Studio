// Import core components
import { useCallback, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useParams } from 'react-router-dom'
import { Button, Dropdown as BSDropdown, Form, Stack, Toast } from 'react-bootstrap'

// Import our components
import { Dropdown } from 'components/global/styled'
import { ToolTip } from 'components/global'
import { selectComponent, updateInteractiveComponent, updateInteractiveSelected } from 'db/slices/interactive'

import { Context } from './Context'
import { PanelButton, PropButton } from './buttons'
import { BackgroundColorPanel, FontColorPanel } from './variable'

// Import style
// ...

export const VariablePanel = (properties) => {
  // Properties
  const { id } = properties
  // Hooks
  const params = useParams()
  const dispatch = useDispatch()
  // Redux
  const component = useSelector((state) => selectComponent(state, id))
  // States
  const [show, setShow] = useState(true)
  const [settings, setSettings] = useState({})
  // Variables
  const url = `?layer-name=${component.label} | SS Var | ${id}&layer-width=960&layer-height=64#/studio/${params.code}/i/variable/${id}`

  const handleClose = (e) => {
    e.preventDefault()

    dispatch(updateInteractiveSelected({ id: undefined }))
    setShow(false)
  }

  const handleChange = useCallback(
    (e, obj) => {
      e?.preventDefault()

      dispatch(updateInteractiveComponent({ id, ...obj }))
    },

    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id]
  )

  const handleSetting = useCallback((e, setting) => {
    e.preventDefault()

    setSettings((_settings) => ({ ..._settings, [setting]: !_settings[setting] }))
  }, [])

  // Memo for context
  const contextValue = useMemo(() => ({ fn: { change: handleChange, toggle: handleSetting }, ...settings }), [handleChange, handleSetting, settings])

  return (
    <Context.Provider value={contextValue}>
      <FontColorPanel color={component.style.fontColor} />
      <BackgroundColorPanel color={component.style.backgroundColor} />
      <Toast show={show} onClose={handleClose}>
        <Toast.Header className="py-2 px-3">
          <Form.Control
            className="bg-transparent border-0 text-dark rounded-0 ps-0 py-0"
            size="sm"
            placeholder={`Variable ${id}`}
            value={component.label || ''}
            onChange={(e) => handleChange(e, { label: e.target.value })}
          />
          <ToolTip placement="top" tooltip={<>Export to OBS</>}>
            <Button size="sm" variant="link" type="button" href={url} target={id}>
              <i className="fas fa-up-right-from-square" />
            </Button>
          </ToolTip>
        </Toast.Header>
        <Toast.Body className="p-3">
          <Stack gap={2}>
            <Stack className="justify-content-center" direction="horizontal" gap={2}>
              <PanelButton
                active={settings.fontFamily}
                icon="font"
                onClick={(e) => handleSetting(e, 'fontFamily')}
                setting="fontFamily"
                style={{ color: component.style.fontFamily }}
                tooltip={<>Font Family</>}
              />
              <PanelButton
                active={settings.fontSize}
                icon="text-height"
                onClick={(e) => handleSetting(e, 'fontSize')}
                setting="fontSize"
                style={{ color: component.style.fontSize }}
                tooltip={<>Font Size</>}
              />
              <PanelButton
                active={settings.fontColor}
                icon="square"
                onClick={(e) => handleSetting(e, 'fontColor')}
                setting="fontColor"
                style={{ color: component.style.fontColor || 'var(--bs-btn-color)' }}
                tooltip={<>Font Color</>}
              />
              <span className="text-dark">|</span>
              <PropButton active={component.style.fontWeight} icon="bold" setting="fontWeight" tooltip={<>Bold</>} value="bold" />
              <PropButton active={component.style.fontStyle} icon="italic" setting="fontStyle" tooltip={<>Italics</>} value="italic" />
              <PropButton active={component.style.textDecoration} icon="underline" setting="textDecoration" tooltip={<>Underline</>} value="underline" />
              <span className="text-dark">|</span>
              <PanelButton
                active={settings.backgroundColor}
                icon="square"
                onClick={(e) => handleSetting(e, 'backgroundColor')}
                setting="backgroundColor"
                style={{ color: component.style.backgroundColor || 'var(--bs-btn-color)' }}
                tooltip={<>Background Color</>}
              />

              {/*
              <Dropdown size="sm" variant="light" title={<i className="fas fa-align-left" />}>
                <ToolTip placement="left" tooltip={<>Align Left</>}>
                  <BSDropdown.Item>
                    <i className="fas fa-align-left" />
                  </BSDropdown.Item>
                </ToolTip>
                <ToolTip placement="left" tooltip={<>Align Center</>}>
                  <BSDropdown.Item>
                    <i className="fas fa-align-center" />
                  </BSDropdown.Item>
                </ToolTip>
                <ToolTip placement="left" tooltip={<>Align Right</>}>
                  <BSDropdown.Item>
                    <i className="fas fa-align-right" />
                  </BSDropdown.Item>
                </ToolTip>
              </Dropdown>
              */}
            </Stack>
          </Stack>
        </Toast.Body>
      </Toast>
    </Context.Provider>
  )
}
