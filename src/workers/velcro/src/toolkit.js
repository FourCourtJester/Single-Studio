import { isEqual, isObject } from 'lodash'
import * as Utils from 'toolkits/utils'

export const channelName = (path) => `velcro|${path}`
export const port = channelName('redux')
export const nullables = [undefined, null, false, '']

// Private functions

function _createPath(path, seperator = '.') {
  return Array.isArray(path) ? path : path.split(seperator)
}

function _entry(path, val) {
  return [path, val]
}

function _update(obj, path, val) {
  switch (path.length) {
    case 0: {
      break
    }

    case 1: {
      return nullables.includes(val) ? remove(obj, path) : { ...obj, [path]: val }
    }

    default: {
      const field = path.at(0)
      const _path = path.slice(1)

      if (!Object.prototype.hasOwnProperty.call(obj, field)) obj[field] = {}

      obj[field] = _update(obj[field], _path, val)
      break
    }
  }

  return obj
}

// Public functions

export function diff(paths, prev, next) {
  return paths.reduce((result, path) => {
    const _prev = Utils.getObjValue(prev, path)
    const _next = Utils.getObjValue(next, path)

    return !isEqual(_prev, _next) ? result.concat([_entry(path, _next)]) : result
  }, [])
}

export function math(obj, fields, sign = 1) {
  fields.forEach(([path, val = 1]) => {
    const signedVal = val * sign
    const existing = Utils.getObjValue(obj, path)
    const newVal = existing ? Number(existing) + signedVal : signedVal

    update(obj, [_entry(path, String(newVal))])
  })
}

export function prepare(arrOrObj, path = undefined) {
  if (!isObject(arrOrObj)) return [_entry(path, arrOrObj)]
  if (Array.isArray(arrOrObj)) return [_entry(path, arrOrObj)]

  const entries = Object.entries(arrOrObj).reduce((result, [key, val]) => {
    const fullPath = path ? [path, key].join('.') : key
    return isObject(val) ? result.concat(prepare(val, fullPath)) : result.concat([_entry(fullPath, val)])
  }, [])

  return entries
}

export function remove(obj, ppath) {
  const path = _createPath(ppath)
  const key = path.at(-1)
  const field = Utils.getObjValue(obj, path.slice(0, -1).join('.')) || obj

  if (field) delete field[key]
  return obj
}

export function swap(obj, fields) {
  const mid = Math.ceil(fields.length / 2)
  const from = Object.entries(fields.slice(0, mid).reduce((_obj, path) => ({ ..._obj, [path]: Utils.getObjValue(obj, path) }), {}))

  fields.slice(mid).forEach((path, i) => {
    const to = Utils.getObjValue(obj, path)

    Utils.setObjValue(obj, from[i][0], to)
    Utils.setObjValue(obj, path, from[i][1])
  })
}

export function update(obj, fields) {
  fields.forEach(([path, val]) => _update(obj, _createPath(path), val))
}
