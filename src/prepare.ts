const { emit } = process

// @ts-expect-error
process.emit = function (event, warning: Error) {
  if (
    event === 'warning' &&
    warning.message ===
      'Custom ESM Loaders is an experimental feature and might change at any time'
  ) {
    return
  }

  return emit.apply(this, arguments as any)
}

export {}
