// Import core components
import { useEffect, useState } from 'react'
import Papa from 'papaparse'

// Import our components
// const API_KEY = window.atob(process.env.REACT_APP_GOOGLE_API_KEY)
const API_KEY = process.env.REACT_APP_GOOGLE_API_KEY
const GOOGLE_API_URL = 'https://sheets.googleapis.com/v4/spreadsheets/:id/values/:range?key=:key'

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

export const useGoogle = ({ id, range, t: ts = 5000 }) => {
  // States
  const [results, setResults] = useState({})

  const handleFetch = (url) => _fetch(url).then((obj) => setResults(obj))

  useEffect(() => {
    const url = GOOGLE_API_URL.replace(':id', id).replace(':range', encodeURIComponent(range)).replace(':key', API_KEY)

    handleFetch(url)

    const t = setInterval(() => {
      handleFetch(url)
    }, ts)

    return () => {
      clearInterval(t)
    }
  }, [id, range, ts])

  return results
}
