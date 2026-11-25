import {
  cpSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  readdirSync,
  readlinkSync,
  rmSync,
} from "node:fs"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
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

// The package exports its build CLI under the `require` condition only.
const { buildAllFonts } = createRequire(import.meta.url)(
  "react-native-nano-icons/cli"
) as typeof import("react-native-nano-icons/cli")

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

test("the built font is named for its current sources", async () => {
  // The font's family is a hash of the SVGs and of the font toolchain's
  // versions, so a lucide-static or toolchain upgrade renames the font that
  // prebuild ships while the committed glyphmap still names the old one, and
  // every glyph draws blank on Android. Rebuild the font: `expo prebuild`.
  // The build runs on a copy, so a stale font never rewrites the repository.
  const outputDir = mkdtempSync(path.join(tmpdir(), "lucide-glyph-"))
  try {
    cpSync(path.join(appDir, "assets/icons/nanoicons"), outputDir, {
      recursive: true,
    })
    const [result] = await buildAllFonts(
      [{ inputDir: svgDir, outputDir, web: true }],
      appDir
    )
    expect(result?.family).toBe(glyphMap.m.f)
  } finally {
    rmSync(outputDir, { recursive: true, force: true })
  }
}, 60_000)
