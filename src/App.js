// Import core components
import { createHashRouter, createRoutesFromElements, Route, RouterProvider } from 'react-router-dom'

// Import our components
import { InteractiveSource, Gate, P404, Studio, Source } from 'pages'

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
          <Route path=":code" lazy={() => Studio} />
          <Route path=":code?/source/:source" lazy={() => Source} />
          <Route path=":code?/i/:type" lazy={() => InteractiveSource} />
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
