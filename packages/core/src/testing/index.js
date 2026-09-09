// Test doubles for the seams a plugin is built on.
//
// Shipped rather than kept internal: a plugin published from the plugin template is
// tested by whoever wrote it, against the same seams these fake, and asking every
// author to write their own socket fake is asking each of them to rediscover the
// same handful of details -- and to get the interesting one wrong, which is that a
// fake must be exactly as awkward as the protocol.
export { FakeSocket, fakeSockets } from './socket'
