/* eslint-disable no-restricted-globals */
// To inspect: chrome://inspect/#workers

// Import core components
import Papa from 'papaparse'
import * as Utils from 'toolkits/utils'

function _fetch(url) {
  return fetch(url)
    .then((response) => {
      if (!response.ok) throw response
      return response.json()
    })
    .then((data) =>
      Papa.parse(Papa.unparse(data.values), {
        complete: (records) => ({
          records: records.data.reduce((arr, record) => {
            // Create the object
            const _obj = {}

            // Re-cast null or undefined values to an empty string
            Object.entries(record).forEach(([key, val]) => {
              _obj[key] = val === null || val === undefined ? '' : val
            })

            // Save the record
            arr.push(_obj)
            return arr
          }, []),
        }),
        dynamicTyping: true, // DynamicTyping auto converts empty columns to null
        header: true,
        skipEmptyLines: true,
        transform: (entry) => entry.trim(),
        transformHeader: (header) => header.trim(),
      })
    )
    .catch((err) => console.error(err))
}

const GOOGLE_API_URL = 'https://sheets.googleapis.com/v4/spreadsheets/:id/values/:range?key=:key&majorDimension=:group&valueRenderOption=:format'
const fetches = {}
const listeners = {}

// Port constructor
self.onconnect = (connections) => {
  const port = connections.ports[0]

  // Port Emit
  const emit = (id, event, response) => port.postMessage({ id, event, response })

  port.addEventListener('message', ({ data: request }) => {
    const { id, data, name, event } = request

    console.log(request)

    switch (event) {
      case 'on': {
        Utils.setObjValue(listeners, `${name}.${id}`, emit.bind(this, id, name))
        break
      }

      case 'off': {
        const listener = Utils.getObjValue(listeners, name)
        delete listener[id]
        break
      }

      default: {
        const { params, query, t } = data
        const url = GOOGLE_API_URL.replace(':id', params.id)
          .replace(':range', encodeURIComponent(params.range))
          .replace(':key', process.env.REACT_APP_GOOGLE_API_KEY)
          .replace(':group', query.majorDimension)
          .replace(':format', query.valueRenderOption)

        const existing = Utils.getObjValue(fetches, url)

        if (existing) {
          clearInterval(existing)
        }

        Utils.setObjValue(
          fetches,
          url,
          setInterval(() => {
            _fetch(url).then((response) => {
              const _listeners = Object.values(Utils.getObjValue(listeners, data.name) || {})

              _listeners.forEach((cb) => cb(response))
            })
          }, t)
        )
        break
      }
    }
  })

  console.log('port started')
  port.start()
}
