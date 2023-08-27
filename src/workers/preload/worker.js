/* eslint-disable no-restricted-globals */
// To inspect: chrome://inspect/#workers

// Worker constructor
self.onmessage = (e) => {
  const targets = e.data || []

  if (!Array.isArray(targets)) {
    self.postMessage([])
    return false
  }

  Promise.all(
    targets.map(async (target) => {
      try {
        const response = await fetch(target)
        const blob = await response.blob()

        return URL.createObjectURL(blob)
      } catch (err) {
        return null
      }
    })
    // Promise.all(
    //   targets.map(
    //     (target) =>
    //       new Promise((resolve, reject) => {
    //         const request = new XMLHttpRequest()

    //         request.open('GET', target, true)
    //         request.send()
    //         request.onload = (req) => {
    //           console.log(target)
    //           resolve(true)
    //         }
    //         request.onerror = (err) => reject(err)
    //       })
    //   )
  ).then((blobs) => self.postMessage(blobs))
}
