import { Observable } from './Observable'
import { Subscription } from './Subscription'

function isUndefined(v) {
  return typeof v === 'undefined'
}

export class Subject extends Observable {
  constructor(seed) {
    super(function subscribe(observer) {
      !isUndefined(seed) && observer.next(this._value)
      this.observers.push(observer)

      return new Subscription(() => {
        const index = this.observers.indexOf(observer)
        if (index >= 0) this.observers.splice(index, 1)
      })
    })

    this._seed = seed
    !isUndefined(seed) && (this._value = seed)
    this.observers = []
  }

  next(x) {
    !isUndefined(this._seed) && (this._value = x)
    this.observers.forEach(observer => observer.next(x))
  }

  error(e) {
    this.observers.forEach(observer => observer.error(e))
    this.observers.length = 0
  }

  complete() {
    this.observers.forEach(observer => observer.complete())
    this.observers.length = 0
  }

  get value() {
    return this._value
  }
}
