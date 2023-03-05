// Import core components
// ...

// Import our components
import * as Utils from 'toolkits/utils'

const storage = localStorage
export const namespace = 'ss'

function _namespace(str) {
  return [namespace, ...(Array.isArray(str) ? str : [str])].join('.')
}

export function get(name) {
  try {
    return JSON.parse(storage.getItem(name))
  } catch (err) {
    console.error(err)
  }
}

export function getAll(key) {
  const all = Object.keys({ ...storage })

  return all.reduce((obj, path) => {
    const _path = path.split('.').slice(1).join('.')
    if (path.startsWith(_namespace(key))) Utils.setObjValue(obj, _path, get(path))
    return obj
  }, {})
}

export function remove(name) {
  storage.removeItem(_namespace(name))
}

export function set(name, obj) {
  storage.setItem(_namespace(name), JSON.stringify(obj))
}
