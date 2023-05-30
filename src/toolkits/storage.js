// Import core components
// ...

// Import our components
import * as Utils from 'toolkits/utils'

export const namespace = 'ss'

function _namespace(str) {
  return [namespace, ...(Array.isArray(str) ? str : [str])].join('.')
}

export function get(name, { addNamespace = true } = {}, storage = localStorage) {
  try {
    return JSON.parse(storage.getItem(addNamespace ? _namespace(name) : name))
  } catch (err) {
    console.error(err)
  }
}

export function getAll(key, storage = localStorage) {
  const all = Object.keys({ ...storage })

  return all.reduce((obj, path) => {
    const _path = path.split('.').slice(1).join('.')
    if (path.startsWith(_namespace(key))) Utils.setObjValue(obj, _path, get(path, { addNamespace: false }))
    return obj
  }, {})
}

export function remove(name, storage = localStorage) {
  storage.removeItem(_namespace(name))
}

export function removeObj(name, obj, storage = localStorage) {
  Utils.getObjPaths(obj, (path) => {
    storage.removeItem(`${_namespace(name)}.${path}`)
  })
}

export function set(name, obj, storage = localStorage) {
  storage.setItem(_namespace(name), JSON.stringify(obj))
}
