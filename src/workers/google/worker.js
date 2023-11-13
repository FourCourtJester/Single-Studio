/* eslint-disable no-restricted-globals */
// To inspect: chrome://inspect/#workers

// Import core components
import Papa from 'papaparse'
import * as Utils from 'toolkits/utils'

function _emit(...params) {
  // eslint-disable-next-line no-use-before-define
  properties.ports.forEach((emit) => emit(...params))
}

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
const properties = {
  intervals: {},
  ports: [],
}

// Port constructor
self.onconnect = (connections) => {
  const port = connections.ports[0]

  // Port Emit
  const emit = (id, event, response) => port.postMessage({ id, event, response })

  properties.ports.push(emit)

  port.addEventListener('message', ({ data: { data, method } }) => {
    switch (method) {
      // 'connect' is currently the only method
      default: {
        const { params, query, t } = data
        const url = GOOGLE_API_URL.replace(':id', params.id)
          .replace(':range', encodeURIComponent(params.range))
          .replace(':key', process.env.REACT_APP_GOOGLE_API_KEY)
          .replace(':group', query.majorDimension)
          .replace(':format', query.valueRenderOption)

        clearInterval(Utils.getObjValue(properties.intervals, url))

        Utils.setObjValue(
          properties.intervals,
          url,
          setInterval(() => _fetch(url).then((response) => _emit(null, data.name, response)), t)
        )

        _fetch(url).then((response) => _emit(null, data.name, response))
        break
      }
    }
  })

  console.log('Google port started')
  port.start()
}
