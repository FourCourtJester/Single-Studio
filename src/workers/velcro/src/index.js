// Import core components
// ...

// Import our components
import subscribeMiddleware, { actions as subscribeActions } from './middleware/subscribe'

export const actions = { ...subscribeActions }
export const middlewares = [subscribeMiddleware]
