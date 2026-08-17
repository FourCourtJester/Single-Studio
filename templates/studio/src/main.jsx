import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { StudioApp } from '@single-studio/core'

import { studio } from './studio'
import './index.css'

createRoot(document.getElementById('app')).render(
  <StrictMode>
    <StudioApp studio={studio} />
  </StrictMode>,
)
