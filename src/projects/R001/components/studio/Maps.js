// Import core components
import { Image, OverlayTrigger, Popover, Row } from 'react-bootstrap'

// Import our components
import { useStudio } from 'hooks'
import { Select } from 'components/studio'
import allMaps from '../maps.json'

// Import style
// ...

/**
 * Studio: Command & Conquer - Maps
 *
 * @returns {React.FunctionComponentElement} React.FunctionComponentElement
 */
function Maps() {
  // Redux
  const currentMap = useStudio(`variables.map`)
  // Variables
  const { maps } = allMaps

  return (
    <Row className="d-flex flex-column justify-content-center align-items-center gx-2">
      {/* {currentMap && <Image className="mb-2" src={`/R001/maps/preview/${currentMap}.webp`} fluid />} */}
      <Select label="Current Map" name="map">
        {maps.map((map) => (
          <option key={map} value={map}>
            {map}
          </option>
        ))}
      </Select>
      <OverlayTrigger
        placement="top"
        overlay={
          <Popover>
            <Popover.Body>
              <Image className="mb-2" src={`/R001/maps/preview/${currentMap}.webp`} fluid />
            </Popover.Body>
          </Popover>
        }
      >
        <a className="text-success text-center m-0">Preview</a>
      </OverlayTrigger>
    </Row>
  )

  // return (
  //   <Row className="g-2 mt-0">
  //     {maps.map((map) => (
  //       <Col xs={4}>
  //         <Button className="d-flex flex-grow-1 justify-content-center align-items-center p-0 w-100 h-100 overflow-hidden" variant="info">
  //           <Image src={`/R001/maps/preview/${map}.webp`} fluid />
  //         </Button>
  //       </Col>
  //     ))}
  //   </Row>
  // )
}

// Exported Component for use
export default Maps
