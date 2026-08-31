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
