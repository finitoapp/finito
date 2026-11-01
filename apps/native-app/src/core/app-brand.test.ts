import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import ts from "typescript"
import { expect, test } from "vitest"

/**
 * The native app ships as Finito (brand/0001), so nothing it shows may say
 * Payky: copy names the app through brand placeholders and code through
 * `brandName(appBrand)`, and it reaches Finito's own hosts through the brand
 * (`appBrand.apiBaseUrl`), never payky.me. Internal identifiers keep their
 * name (`PaykyNfc`, `payky.terminalHomeMode`, `payky:` URIs), so only the
 * word "Payky" and the host payky.me in string literals and JSX text count,
 * and comments are free to explain.
 */

const appDir = path.resolve(import.meta.dirname, "../..")

const files = (dir: string, pattern: RegExp): ReadonlyArray<string> =>
  readdirSync(path.join(appDir, dir), { recursive: true })
    .map(String)
    .filter((file) => pattern.test(file) && !/\.test\.tsx?$/u.test(file))
    .map((file) => path.join(dir, file))

const brandWord = /\bPayky\b|\bpayky\.me\b/u

const textNodeKinds = new Set([
  ts.SyntaxKind.StringLiteral,
  ts.SyntaxKind.NoSubstitutionTemplateLiteral,
  ts.SyntaxKind.TemplateHead,
  ts.SyntaxKind.TemplateMiddle,
  ts.SyntaxKind.TemplateTail,
  ts.SyntaxKind.JsxText,
])

const brandedTexts = (file: string): ReadonlyArray<string> => {
  const source = ts.createSourceFile(
    file,
    readFileSync(path.join(appDir, file), "utf8"),
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  )
  const found: string[] = []
  const visit = (node: ts.Node) => {
    if (textNodeKinds.has(node.kind) && brandWord.test(node.getText(source))) {
      const { line } = source.getLineAndCharacterOfPosition(node.getStart())
      found.push(`${file}:${line + 1}: ${node.getText(source).trim()}`)
    }
    node.forEachChild(visit)
  }
  visit(source)
  return found
}

test("the native app's code shows no Payky", () => {
  const sources = [
    "app.config.ts",
    ...files("app", /\.tsx?$/u),
    ...files("src", /\.tsx?$/u),
  ]
  expect(sources.flatMap(brandedTexts)).toEqual([])
})

test("the native app's web export names no Payky", () => {
  const mentions = files("public", /\.(?:html|webmanifest|txt|svg)$/u).filter(
    (file) => /payky/iu.test(readFileSync(path.join(appDir, file), "utf8"))
  )
  expect(mentions).toEqual([])
})
