let _adapter

export function setAdapter(adapter) {
  _adapter = adapter
}

export function adapt($) {
  return _adapter ? _adapter($) : $
}
