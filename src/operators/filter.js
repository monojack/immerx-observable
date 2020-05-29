import { Observable } from '../internal/Observable'

export function filter(predicate) {
  return function filterOperator(source) {
    if (source.filter) {
      return source.filter(predicate)
    } else {
      const Ctor = source.constructor ?? Observable

      return new Ctor(observer =>
        source.subscribe({
          next(value) {
            try {
              if (!predicate(value)) return
            } catch (e) {
              return observer.error(e)
            }
            observer.next(value)
          },
          error(e) {
            observer.error(e)
          },
          complete() {
            observer.complete()
          },
        }),
      )
    }
  }
}
