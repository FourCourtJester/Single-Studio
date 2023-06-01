// Import core components
import { createHashRouter, createRoutesFromElements, Route, RouterProvider } from 'react-router-dom'

// Import our components
import { Gate, P404, Studio, Source, Single } from 'pages'

// Import style
import 'scss/base.scss'

function routes() {
  return createHashRouter(
    createRoutesFromElements(
      <>
        {/* Landing */}
        <Route index Component={Gate} />
        {/* Studio/Source */}
        <Route path="studio">
          <Route path=":code">
            <Route index lazy={() => Studio} />
            <Route path="source/single/:source" lazy={() => Single} />
            <Route path="source/:source" lazy={() => Source} />
          </Route>
        </Route>
        {/* 404 */}
        <Route path="*" Component={P404} />
      </>
    )
  )
}

function App() {
  return <RouterProvider router={routes()} />
}

export default App
