import { expect } from "vitest"

/**
 * Asserts that `patterns` match `source` one after another, each after the
 * previous match — for the tests that hold a screen or a hook to doing one
 * thing before another (the PIN before a send, `discard` before a cart
 * write) by reading its source.
 */
export const expectInOrder = (
  source: string,
  ...patterns: ReadonlyArray<RegExp>
): void => {
  let remainder = source
  for (const pattern of patterns) {
    const match = remainder.match(pattern)
    expect(match, `missing ${pattern}`).not.toBeNull()
    if (match === null) return
    if (match.index === undefined) throw new Error(`no index for ${pattern}`)
    remainder = remainder.slice(match.index + match[0].length)
  }
}

/**
 * One of a hook's own functions in `hook`'s source, from its
 * `const <name> = ` up to the next `const` the hook declares.
 */
export const hookFunction = (hook: string, name: string): string => {
  const start = hook.indexOf(`\n  const ${name} = `)
  expect(start, `missing ${name}`).toBeGreaterThan(-1)
  const end = hook.indexOf("\n  const ", start + 1)
  return hook.slice(start, end === -1 ? undefined : end)
}
