// Test doubles for the seams a plugin is built on.
//
// Shipped rather than kept internal: a plugin published from the plugin template is
// tested by whoever wrote it, against the same seams these fake, and asking every
// author to write their own socket fake is asking each of them to rediscover the
// same handful of details -- and to get the interesting one wrong, which is that a
// fake must be exactly as awkward as the protocol.
// `.js`, unlike everywhere else in this package.
//
// Every other source file here is consumed through the bundled `dist`, where the
// bundler resolves an extensionless import and nobody ever notices. This entry is
// shipped as *source* and imported by Node's own resolver, which does not: it wants
// the extension, and without it the package installs cleanly and throws on first
// import. Caught by verify-template.mjs, which is the only thing that looks at this
// package the way somebody installing it does.
export { FakeSocket, fakeSockets } from './socket.js'
