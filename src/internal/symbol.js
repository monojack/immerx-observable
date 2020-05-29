export const observable = (() =>
  typeof Symbol === 'function' && Symbol.observable
    ? Symbol.observable
    : '@@observable')()
