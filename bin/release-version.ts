/**
 * Payky's CalVer: `YY.M.MICRO`, where MICRO counts the releases of that
 * month from 0. A release is the `v<version>` tag on the commit that set
 * `version` in `package.json` (`bin/release.ts`, `docs/releases.md`).
 */
import { format } from "date-fns"

export const nextReleaseVersion = (
  tags: ReadonlyArray<string>,
  date: Date
): string => {
  const month = `${format(date, "yy")}.${format(date, "M")}`
  const micros = tags.flatMap((tag) => {
    const match = /^v(\d+\.\d+)\.(\d+)$/u.exec(tag)
    return match?.[1] === month ? [Number(match[2])] : []
  })
  return `${month}.${Math.max(-1, ...micros) + 1}`
}

/** `vite.config.ts` recognizes a release build by this subject on HEAD. */
export const releaseCommitSubject = (version: string): string =>
  `chore(release): v${version}`
