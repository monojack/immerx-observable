import { observable as Symbol_observable } from './symbol'

export class Observable {
  constructor(subscribe) {
    if (!(this instanceof Observable))
      throw new TypeError('Observable cannot be called as a function')

    if (typeof subscribe !== 'function')
      throw new TypeError('Observable initializer must be a function')

    this._subscribe = subscribe
  }

  subscribe(observer) {
    if (typeof observer !== 'object' || observer === null) {
      observer = {
        next: observer,
        error: arguments[1],
        complete: arguments[2],
      }
    }
    return this._subscribe(observer)
  }

  [Symbol_observable]() {
    return this
  }
}
