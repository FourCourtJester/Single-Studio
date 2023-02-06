// Import core components
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import App from 'App'

// Import our components
import store from 'db/store'

const root = createRoot(document.getElementById('app'))

// Page Render
root.render(
  <StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </StrictMode>
)
