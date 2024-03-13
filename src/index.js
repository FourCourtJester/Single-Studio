// Import core components
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from 'App'

const root = createRoot(document.getElementById('app'))

// Page Render
root.render(
  <StrictMode>
    <App />
  </StrictMode>
)
