// Import core components
// ...

// Import our components
import * as Utils from 'toolkits/utils'

export const namespace = 'ss'

function _namespace(parts) {
  return [namespace, ...(Array.isArray(parts) ? parts : [parts])].join('.')
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
    if (!path.startsWith(_namespace(key))) return obj

    const _path = path.split('.').slice(1).join('.')
    const val = get(path, { addNamespace: false })

    return Utils.setObjValue(obj, _path, val)
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
