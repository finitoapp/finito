export const createSeededRandom = (seed: number) => {
  let state = seed
  return (below: number) => {
    state = (state + 0x6d2b79f5) | 0
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state)
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed
    return Math.floor((((mixed ^ (mixed >>> 14)) >>> 0) / 2 ** 32) * below)
  }
}

export type SeededRandom = ReturnType<typeof createSeededRandom>

const textPieces = [
  ..."0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ234567abcdefxyz",
  ..." .-_*%#/:?&=+\n\t\u0000ÁČŘžš😀",
  "PK1 ",
  "pk1",
  " A",
  " R",
]

export const createRandomText = (
  random: SeededRandom,
  maxLength: number
): string =>
  Array.from(
    { length: random(maxLength + 1) },
    () => textPieces[random(textPieces.length)] ?? ""
  ).join("")
