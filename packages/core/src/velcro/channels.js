// Naming for the BroadcastChannels the host publishes on.
//
// One channel per subscribed path. That looks profligate but it is the point:
// a lower-third listening to `variables.home.name` is never woken by a change
// to the shot clock, which matters when a dozen OBS browser sources share a
// CEF process.

export const namespaceFor = (studio) => `velcro:${studio}`

export const channelFor = (studio, path) => `${namespaceFor(studio)}:@${path}`

/** Host lifecycle announcements (ready, sync status, peer presence). */
export const statusChannelFor = (studio) => `${namespaceFor(studio)}:#status`
