import { filter } from './filter'

const EMPTY_OBJ = {}
export function patchOf(o = EMPTY_OBJ) {
  return function patchOfOperator(source) {
    if (o === EMPTY_OBJ) {
      return source
    }

    const { op, ops = [op], path = [] } = o
    return filter(
      patch =>
        (ops.filter(Boolean).length === 0 || ops.includes(patch.op)) &&
        RegExp(`^${path.join('.')}`).test(patch.path.join('.')),
    )(source)
  }
}
