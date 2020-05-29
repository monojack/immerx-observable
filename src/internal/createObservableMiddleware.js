import { Subject } from './Subject'
import { adapt } from './adapter'

const noop = () => {}
const defaultOptions = {
  dependencies: {},
}

export function createObservableMiddleware(options) {
  const opts =
    options !== null && typeof options === 'object'
      ? { ...defaultOptions, ...options }
      : defaultOptions

  let _state$
  const patchSubject$ = new Subject()
  const stateSubject$ = new Subject()

  const middleware = state$ => {
    if (process.env.NODE_ENV !== 'production' && _state$) {
      throw new Error(`The middleware is already initialized`)
    }

    _state$ = state$

    return ({ patches }, state) => {
      if (!!opts.ignoreEmptyPatches && patches.length === 0) return

      // notify
      stateSubject$.next(state)
      for (const patch of patches) {
        patchSubject$.next(patch)
      }
    }
  }

  middleware.run = rootEpic => {
    if (process.env.NODE_ENV !== 'production' && !_state$) {
      if (!_state$) {
        throw new Error(
          'run(rootEpic) was called before initialization. You have to provide the middleware to immerx.create() first',
        )
      }

      if (rootEpic === noop) {
        throw new Error(`You didn't provide a rootEpic to run()`)
      }
    }

    if (rootEpic !== noop) {
      const epic$ = rootEpic(
        adapt(patchSubject$),
        adapt(stateSubject$),
        opts.dependencies,
      )
      if (!epic$) {
        throw new Error(`Your rootEpic doesn't return anything.`)
      }

      if (!epic$.subscribe || typeof epic$.subscribe !== 'function') {
        throw new Error(`Your rootEpic doesn't return a subscribable`)
      }

      // subscribe
      epic$.subscribe({
        next: cb => _state$.update?.(cb),
      })
    }
  }

  return middleware
}
