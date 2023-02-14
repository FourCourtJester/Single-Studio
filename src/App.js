// Import core components
import { HashRouter as Router, Routes, Route } from 'react-router-dom'

// Import our components
import { Gate, P404, Source, Studio } from 'pages'

// Import style
import 'scss/base.scss'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Gate />} />
        <Route path="/project/:code/studio" element={<Studio />} />
        <Route path="/project/:code/source/:source" element={<Source />} />
        <Route path="*" element={<P404 />} />
      </Routes>
    </Router>
  )
}

export default App
