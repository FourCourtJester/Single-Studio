import _slugify from 'slugify'

export function capitalize(str, spacer = ' ') {
  return str.split(spacer).map((part) => part.at(0).toUpperCase() + part.slice(1))
}

export function debounce(func, wait, immediate) {
  let t

  return function (...args) {
    const context = this
    const now = immediate && !t

    if (t) clearTimeout(t)

    t = setTimeout(() => {
      t = null
      if (!immediate) func.apply(context, args)
    }, wait)

    if (now) func.apply(context, args)
  }
}

export function getObjPaths(obj, fn, path = '') {
  Object.entries(obj || {}).forEach(([key, val]) => {
    const _key = path.length ? [path, key].join('.') : key
    const arrayCheck = Array.isArray(val)
    const mongooseCheck = getObjValue(val, '_bsontype') || false
    const nullCheck = val === null
    const objectCheck = (typeof val).toLowerCase() !== 'object'

    // Do not recurse upon primitive objects
    // Do not recurse upon Arrays
    // Do not recurse upon Mongoose ObjectIDs
    if (objectCheck || arrayCheck || mongooseCheck || nullCheck || (!nullCheck && !Object.keys(val).length)) {
      return fn(_key, val)
    }

    // Recurse
    return getObjPaths(val, fn, _key)
  })
}

export function getObjProps(obj, props = []) {
  const result = {}

  props.forEach((prop) => (result[prop] = obj?.[prop]))

  // return (({ ..._ }) => ({ ...props }))(obj)
  return result
}

export function getObjValue(obj = {}, _path = '', opts = { split: true }) {
  if (obj === undefined) return undefined
  if (_path === null) return undefined

  // Do not alter if already the proper type
  let path = !Array.isArray(_path) ? undefined : _path

  // Convert to an array
  if (path === undefined) {
    path = opts.split ? _path.toString().split('.') : [_path.toString()]
  }

  // If the prop does not exist, return undefined
  // Otherwise, return the value
  return path.reduce((val, part) => (val?.[part] === undefined ? undefined : val[part]), obj)
}

export function setObjValue(obj = {}, _path = [], val = undefined, opts = { split: true }) {
  // Do not alter if already the proper type
  let path = !Array.isArray(_path) ? undefined : _path

  // Convert to an array
  if (path === undefined) {
    path = opts.split ? _path.toString().split('.') : [_path.toString()]
  }

  // Edge case: No path length. Just return
  if (!path.length) {
    return obj
  }

  // When there is no more depth to recurse, assign the value
  if (path.length === 1) {
    obj[path] = val
    return obj
  }

  // Get the prop
  const field = path.shift()

  if (field.includes('[')) {
    // Array, not an Object
    const [shortField, key] = field.match(/\w+\b/g)

    // If the prop does not exist, create it
    if (!Object.prototype.hasOwnProperty.call(obj, shortField)) obj[shortField] = []

    // Instantiate the array index, if required
    if (!obj[shortField][key || 0]) obj[shortField][key || 0] = {}

    // Recurse
    obj[shortField][key] = setObjValue(obj[shortField][key], path, val)
  } else {
    // If the prop does not exist, create it
    if (!Object.prototype.hasOwnProperty.call(obj, field)) obj[field] = {}

    // Recurse
    obj[field] = setObjValue(obj[field], path, val)
  }

  return obj
}

export function ordinal(num) {
  if (num % 10 === 1 && num % 100 !== 11) return `${num}st`
  if (num % 10 === 2 && num % 100 !== 12) return `${num}nd`
  if (num % 10 === 3 && num % 100 !== 13) return `${num}rd`
  return `${num}th`
}

export function slugify(str) {
  return _slugify(str, {
    replacement: '-',
    remove: /[,*+~.()'"!:@]/g,
    lower: true,
    trim: true,
  })
}
