// Import core components
import Papa from 'papaparse'

// Import our components
import { Utils as VelcroUtils } from 'workers/velcro/utils'

const defaults = {
  majorDimension: 'ROWS',
  t: 5 * 1000,
  valueRenderOption: 'FORMATTED_VALUE',
}
const URL = 'https://sheets.googleapis.com/v4/spreadsheets/:id/values/:range?key=:key&majorDimension=:group&valueRenderOption=:format'

class Singleton {
  static #instance

  #intervals = {}

  #port

  constructor() {
    this.#port = new BroadcastChannel(VelcroUtils.port)

    // Save the instance
    Singleton.#instance = this
  }

  // Private Functions

  // eslint-disable-next-line class-methods-use-this
  #fetch(url) {
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
  }

  // Public Functions

  connect(props) {
    const { name, id, majorDimension = defaults.majorDimension, range, t = defaults.t, valueRenderOption = defaults.valueRenderOption } = props

    // if (this.#intervals[name]) return false

    const url = URL.replace(':id', id)
      .replace(':range', encodeURIComponent(range))
      .replace(':key', process.env.REACT_APP_GOOGLE_API_KEY)
      .replace(':group', majorDimension)
      .replace(':format', valueRenderOption)

    clearInterval(this.#intervals[name])

    this.#intervals[name] = setInterval(
      () =>
        this.#fetch(url)
          .then((response) => this.#port.postMessage({ action: `google:${name}`, data: response.data }))
          .catch((err) => console.error(err)),
      t
    )
  }

  // Static Functions

  static getInstance() {
    return Singleton.#instance ? Singleton.#instance : new Singleton()
  }
}

export default Singleton
