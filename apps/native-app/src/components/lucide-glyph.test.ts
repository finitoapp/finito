import { existsSync, lstatSync, readdirSync, readlinkSync } from "node:fs"
import path from "node:path"
import { expect, test } from "vitest"
import glyphMap from "../../assets/icons/nanoicons/lucide.glyphmap.json"
import packageJson from "../../package.json"

/**
 * `LucideGlyph`'s font is built from `assets/icons/lucide`, symlinks into
 * `lucide-static`'s SVGs, so a glyph draws what the same lucide icon draws
 * everywhere else in both apps.
 */

const appDir = path.resolve(import.meta.dirname, "../..")
const svgDir = path.join(appDir, "assets/icons/lucide")
const svgFiles = readdirSync(svgDir)

test("lucide-static is the version of lucide-react-native", () => {
  expect(packageJson.devDependencies["lucide-static"]).toBe(
    packageJson.dependencies["lucide-react-native"]
  )
})

test("each glyph source is a symlink to a lucide-static icon", () => {
  const notLinks = svgFiles.filter((file) => {
    const filePath = path.join(svgDir, file)
    return (
      !lstatSync(filePath).isSymbolicLink() ||
      readlinkSync(filePath) !==
        `../../../node_modules/lucide-static/icons/${file}` ||
      !existsSync(filePath)
    )
  })
  expect(notLinks).toEqual([])
})

test("the built font holds exactly the linked icons", () => {
  // A differing list means the font was not rebuilt: `expo prebuild`.
  expect(Object.keys(glyphMap.i).sort()).toEqual(
    svgFiles.map((file) => file.replace(/\.svg$/u, "")).sort()
  )
})
