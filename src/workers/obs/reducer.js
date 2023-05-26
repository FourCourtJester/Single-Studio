import * as Utils from 'toolkits/utils'

const actions = ['connect'].map((action) => action.toUpperCase())

export const OBSActions = actions.reduce((obj, action) => ({ ...obj, [action]: action }), {})
