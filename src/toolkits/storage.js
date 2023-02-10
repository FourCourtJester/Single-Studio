// Import core components
// ...

// Import our components
// ...

const storage = localStorage
export const namespace = 'ss'

function _namespace(str) {
  return [namespace, ...(Array.isArray(str) ? str : [str])].join('.')
}

/**
 * Get the item from storage
 * @param {String} name
 */
export function get(name) {
  try {
    return JSON.parse(storage.getItem(_namespace([name])))
  } catch (err) {
    console.error(err)
  }
}

/**
 * Set the item into storage
 * @param {String} name
 * @param {*} obj
 */
export function set(name, obj) {
  storage.setItem(_namespace([name]), JSON.stringify(obj))
}
