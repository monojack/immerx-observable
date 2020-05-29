import { merge } from './merge'

export function combineEpics(...epics) {
  return function combinedEpic(...args) {
    return merge(
      ...epics.map(epic => {
        const sink$ = epic(...args)

        if (!sink$) {
          throw new Error(
            `One of your epics${epic.name ?? ''} doesn't return anything.`,
          )
        }
        return sink$
      }),
    )
  }
}
