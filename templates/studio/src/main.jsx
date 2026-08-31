// Where the page starts. Hands your studio to the framework, which does the routing
// -- one route for the operator's board, one per graphic. Nothing to change here.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Studio } from '@single-studio/core'

import { studio } from './studio'
import './index.css'

createRoot(document.getElementById('app')).render(
  <StrictMode>
    <Studio studio={studio} />
  </StrictMode>,
)
