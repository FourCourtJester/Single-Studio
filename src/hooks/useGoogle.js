// Import core components

// Import our components

const API_KEY = process.env.REACT_APP_GOOGLE_API_KEY
const GOOGLE_API_URL = 'https://sheets.googleapis.com/v4/spreadsheets/:id/values/:range?valueRenderOption=FORMULA&key=:key'
const SHEET_ID = '1egBgXL0ovtdxGUPOG7p2dK3N96xDlkV5uourbA1qkYk'

export const useGoogle = () => {
  const url = GOOGLE_API_URL.replace(':id', SHEET_ID).replace(':range', 'Teams!A1:D3').replace(':key', API_KEY)

  fetch(url)
    .then((response) => {
      if (!response.ok) throw response
      return response.json()
    })
    .then((data) => console.log(data))
    .catch((err) => console.error(err))
}
