import { NonEmptyString255 } from "../shared/schema.ts"

// Excludes 0/O and 1/I so a printed code can't be misread.
const TABLE_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
const TABLE_CODE_LENGTH = 8

/**
 * Generates a table's `code`, its id towards Qerko: `getTableList` lists the
 * tables by it and `getTableContents` names one by it (qerko/0017).
 */
export function generateTableCode(): NonEmptyString255 {
  let code = ""
  for (let i = 0; i < TABLE_CODE_LENGTH; i++) {
    const char =
      TABLE_CODE_ALPHABET[
        Math.floor(Math.random() * TABLE_CODE_ALPHABET.length)
      ]
    if (char === undefined) {
      throw new Error("Unreachable: index is always within alphabet bounds")
    }
    code += char
  }

  return NonEmptyString255(code)
}
