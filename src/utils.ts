import stripJsonComments from 'strip-json-comments'

export function jsoncParse(data: string) {
  try {
    return JSON.parse(stripJsonComments(data))
  } catch {
    // Silently ignore any error
    // That's what tsc/jsonc-parser did after all
    return {}
  }
}
