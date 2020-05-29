export {
  createObservableMiddleware,
  createObservableMiddleware as default,
} from './internal/createObservableMiddleware'
export { combineEpics } from './internal/combineEpics'
export { setAdapter } from './internal/adapter'

export const REPLACE = 'replace'
export const ADD = 'add'
export const REMOVE = 'remove'
