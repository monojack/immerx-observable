import { Observable } from './Observable'
import { Subscription } from './Subscription'

export function merge(...observables) {
  if (observables.length === 1) {
    // TODO: check if observable
    return observables[0]
  }

  return new Observable(listener => {
    const subs = observables.map(observable => observable.subscribe(listener))

    return new Subscription(() => {
      subs.forEach(sub => {
        sub.unsubscribe()
      })
    })
  })
}
