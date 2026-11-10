import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import ts from "typescript"
import { expect, test } from "vitest"

/**
 * The native ui kit is the only place that knows how a primitive looks, so it
 * stays as free of app knowledge as web's `components/ui`: it receives
 * translated strings and theme keys, never atoms, hooks or i18n.
 */

const srcDir = path.resolve(import.meta.dirname, "../..")
const uiDir = import.meta.dirname

const sourceFiles = (dir: string): ReadonlyArray<string> =>
  readdirSync(dir, { recursive: true })
    .map(String)
    .filter((file) => /\.tsx?$/u.test(file) && !/\.test\.tsx?$/u.test(file))
    .map((file) => path.join(dir, file))

const importSpecifiers = (source: string): ReadonlyArray<string> =>
  [
    ...source.matchAll(
      /(?:\bfrom\s+|\bimport\s*\(\s*|^\s*import\s+)["']([^"']+)["']/gmu
    ),
  ].flatMap((match) => (match[1] === undefined ? [] : [match[1]]))

const relativeToSrc = (file: string) => path.relative(srcDir, file)

const uiPackages = new Set([
  "react",
  "react-native",
  "react-native-safe-area-context",
  "react-native-svg",
])

const allowedInUi = (file: string, specifier: string): boolean => {
  if (specifier.startsWith(".")) {
    const target = relativeToSrc(
      path.resolve(path.dirname(file), specifier)
    ).split(path.sep)
    return (
      (target[0] === "components" && target[1] === "ui") ||
      target[0] === "theme" ||
      // The system's reduce-motion setting, which a kit animation honours
      // as web's `motion-reduce:` does; no app knowledge.
      target.join("/") === "platform/reduce-motion.ts"
    )
  }
  return (
    uiPackages.has(specifier) ||
    specifier === "tamagui" ||
    // The behavior-only primitives the kit skins (`ui/button` on its button).
    specifier === "tamagui/unstyled" ||
    specifier === "lucide-react-native" ||
    specifier.startsWith("lucide-react-native/icons/")
  )
}

test("components/ui imports only tamagui, react-native, lucide, the theme and reduce motion", () => {
  const violations = sourceFiles(uiDir).flatMap((file) =>
    importSpecifiers(readFileSync(file, "utf8"))
      .filter((specifier) => !allowedInUi(file, specifier))
      .map((specifier) => `${relativeToSrc(file)} imports ${specifier}`)
  )
  expect(violations).toEqual([])
})

test("components and hooks never import features", () => {
  const violations = [
    ...sourceFiles(path.join(srcDir, "components")),
    ...sourceFiles(path.join(srcDir, "hooks")),
  ].flatMap((file) =>
    importSpecifiers(readFileSync(file, "utf8"))
      .filter(
        (specifier) =>
          specifier.startsWith(".") &&
          relativeToSrc(path.resolve(path.dirname(file), specifier)).startsWith(
            `features${path.sep}`
          )
      )
      .map((specifier) => `${relativeToSrc(file)} imports ${specifier}`)
  )
  expect(violations).toEqual([])
})

test("components/ui never passes a numeric lineHeight", () => {
  // Tamagui reads a bare number as a size token: 32 becomes ~2000 px.
  const violations = sourceFiles(uiDir).filter((file) =>
    /lineHeight\s*[:=]\s*\{?\s*\d/u.test(readFileSync(file, "utf8"))
  )
  expect(violations.map(relativeToSrc)).toEqual([])
})

test("components/ui takes colors from the theme", () => {
  const literal = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?)\([^)]*\)/giu
  const allowed = new Set(["rgba(0,0,0,0.5)"])
  const violations = sourceFiles(uiDir).flatMap((file) =>
    [...readFileSync(file, "utf8").matchAll(literal)]
      .map((match) => match[0].replaceAll(" ", ""))
      .filter((color) => !allowed.has(color))
      .map((color) => `${relativeToSrc(file)} uses ${color}`)
  )
  expect(violations).toEqual([])
})

test("lucide icons are imported per module, never from the package root", () => {
  // Metro does not tree-shake: the root pulls in every icon (+2 MB).
  const rootValueImport =
    /^\s*import\s+(?!type\b)[^"']*from\s+["']lucide-react-native["']/mu
  const violations = [
    ...sourceFiles(srcDir),
    ...sourceFiles(path.resolve(srcDir, "../app")),
  ]
    .filter((file) => rootValueImport.test(readFileSync(file, "utf8")))
    .map(relativeToSrc)
  expect(violations).toEqual([])
})

test("colors come from the web palette, never Tamagui's default color scales", () => {
  // `red-600` and friends exist only in @tamagui/config's palette and have no
  // web counterpart; web's roles are `destructive`, `success`, `warning`, `info`.
  const defaultScale =
    /["'](?:red|green|orange|blue|yellow|gray|purple|pink)\d*-\d+["']/u
  const violations = [
    ...sourceFiles(srcDir),
    ...sourceFiles(path.resolve(srcDir, "../app")),
  ]
    .filter((file) => defaultScale.test(readFileSync(file, "utf8")))
    .map(relativeToSrc)
  expect(violations).toEqual([])
})

/**
 * The tamagui and react-native members the kit wraps. A feature importing one
 * draws a control of its own instead of web's, so it uses `components/ui/*`.
 * Namespace, default and dynamic imports of either package are refused too:
 * they would hide which member a feature reaches for.
 */
const kitWrapped: Readonly<Record<string, ReadonlySet<string>>> = {
  tamagui: new Set(["Button", "Card", "Input", "Switch"]),
  "react-native": new Set(["Switch", "TextInput"]),
}

const kitBypasses = (source: string): ReadonlyArray<string> => [
  ...[
    ...source.matchAll(
      /\b(?:import|export)\s+(type\s+)?([^"';]*?)\s*from\s+["'](tamagui|react-native)["']/gu
    ),
  ].flatMap(([, typeOnly, clause = "", pkg = ""]) => {
    if (typeOnly !== undefined) return []
    const named = (/\{([^}]*)\}/u.exec(clause)?.[1] ?? "").replace(
      /\/\*[\s\S]*?\*\/|\/\/[^\n]*/gu,
      ""
    )
    const unnamed = clause
      .replace(/\{[^}]*\}/u, "")
      .replace(/,/gu, "")
      .trim()
    return [
      ...(unnamed === "" ? [] : [`${unnamed} from ${pkg}`]),
      ...named
        .split(",")
        .map((specifier) => specifier.trim())
        .filter((specifier) => specifier !== "" && !/^type\s/u.test(specifier))
        .map((specifier) => specifier.split(/\s+as\s+/u)[0] ?? "")
        .filter((member) => kitWrapped[pkg]?.has(member) === true)
        .map((member) => `${member} from ${pkg}`),
    ]
  }),
  ...[
    ...source.matchAll(
      /\b(?:import|require)\s*\(\s*["'](tamagui|react-native)["']/gu
    ),
  ].map(([, pkg]) => `dynamic import of ${pkg}`),
]

test("features render the kit's Button, Card, Input and Switch, not the raw ones", () => {
  const violations = sourceFiles(path.join(srcDir, "features")).flatMap(
    (file) =>
      kitBypasses(readFileSync(file, "utf8")).map(
        (bypass) => `${relativeToSrc(file)} imports ${bypass}`
      )
  )
  expect(violations).toEqual([])
})

test("kitBypasses sees through aliases, namespaces, re-exports and dynamic imports", () => {
  expect(
    kitBypasses(`
      import { Pressable, Switch as Toggle } from "react-native"
      import {
        // the toggle
        Input,
      } from "tamagui"
      import { Text, Button } from "tamagui"
      import * as RN from "react-native"
      import Tamagui, { YStack } from "tamagui"
      export { Card } from "tamagui"
      const { TextInput } = require("react-native")
    `)
  ).toEqual([
    "Switch from react-native",
    "Input from tamagui",
    "Button from tamagui",
    "* as RN from react-native",
    "Tamagui from tamagui",
    "Card from tamagui",
    "dynamic import of react-native",
  ])
})

test("kitBypasses allows the rest of both packages and type-only imports", () => {
  expect(
    kitBypasses(`
      import { Pressable, TextInputProps } from "react-native"
      import type { TextInput } from "react-native"
      import { type InputProps, Text, XStack } from "tamagui"
      import { Switch } from "../../components/ui/switch.tsx"
    `)
  ).toEqual([])
})

const parseTsx = (file: string, source: string): ts.SourceFile =>
  ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  )

/**
 * The `styled()` frames a file declares (only its exported ones with
 * `exportedOnly`), by name, each with whether its own style sets `cursor`.
 */
const styledFrameCursors = (
  sourceFile: ts.SourceFile,
  exportedOnly = false
): ReadonlyMap<string, boolean> =>
  new Map(
    sourceFile.statements
      .filter(ts.isVariableStatement)
      .filter(
        (statement) =>
          !exportedOnly ||
          statement.modifiers?.some(
            (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
          ) === true
      )
      .flatMap((statement) => statement.declarationList.declarations)
      .flatMap((declaration) => {
        const call = declaration.initializer
        if (
          !ts.isIdentifier(declaration.name) ||
          call === undefined ||
          !ts.isCallExpression(call) ||
          call.expression.getText(sourceFile) !== "styled"
        )
          return []
        const style = call.arguments[1]
        const hasCursor =
          style !== undefined &&
          ts.isObjectLiteralExpression(style) &&
          style.properties.some(
            (property) => property.name?.getText(sourceFile) === "cursor"
          )
        return [[declaration.name.text, hasCursor] as const]
      })
  )

/** The local names a file imports as values from `tamagui`. */
const tamaguiImports = (sourceFile: ts.SourceFile): ReadonlySet<string> =>
  new Set(
    sourceFile.statements.flatMap((statement) => {
      if (
        !ts.isImportDeclaration(statement) ||
        !ts.isStringLiteral(statement.moduleSpecifier) ||
        statement.moduleSpecifier.text !== "tamagui"
      )
        return []
      const bindings = statement.importClause?.namedBindings
      if (bindings === undefined || !ts.isNamedImports(bindings)) return []
      return bindings.elements
        .filter((element) => !element.isTypeOnly)
        .map((element) => element.name.text)
    })
  )

/**
 * Elements in `source` that take `onPress` but show no pointer cursor on web:
 * a tamagui primitive (`View`, `XStack`, `Text`, ...) without a `cursor`
 * prop, or a `styled()` frame (its own, or an exported one in
 * `sharedFrames`) whose style sets none. Other tags draw their own cursor:
 * the kit's components are checked in their own files, and react-native's
 * `Pressable` sets one itself.
 */
const pressablesWithoutCursor = (
  file: string,
  source: string,
  sharedFrames: ReadonlyMap<string, boolean> = new Map()
): ReadonlyArray<string> => {
  const sourceFile = parseTsx(file, source)
  const frames = styledFrameCursors(sourceFile)
  const primitives = tamaguiImports(sourceFile)
  const violations: string[] = []
  const visit = (node: ts.Node): void => {
    const opening = ts.isJsxElement(node)
      ? node.openingElement
      : ts.isJsxSelfClosingElement(node)
        ? node
        : undefined
    if (opening !== undefined) {
      const tag = opening.tagName.getText(sourceFile)
      const attributes = new Set(
        opening.attributes.properties.flatMap((attribute) =>
          ts.isJsxAttribute(attribute)
            ? [attribute.name.getText(sourceFile)]
            : []
        )
      )
      const frameCursor = primitives.has(tag)
        ? false
        : (frames.get(tag) ?? sharedFrames.get(tag))
      if (
        attributes.has("onPress") &&
        frameCursor === false &&
        !attributes.has("cursor")
      ) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(
          opening.getStart()
        )
        violations.push(`${tag} at line ${line + 1}`)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return violations
}

test("every pressable shows the pointer cursor on web", () => {
  // Tamagui's views have no cursor of their own, so a pressable one showed
  // the arrow under the mouse in the web build.
  const files = [
    ...sourceFiles(srcDir),
    ...sourceFiles(path.resolve(srcDir, "../app")),
  ].filter((file) => file.endsWith(".tsx"))
  const sources = new Map(
    files.map((file) => [file, readFileSync(file, "utf8")] as const)
  )
  const sharedFrames = new Map(
    [...sources].flatMap(([file, source]) => [
      ...styledFrameCursors(parseTsx(file, source), true),
    ])
  )
  const violations = [...sources].flatMap(([file, source]) =>
    pressablesWithoutCursor(file, source, sharedFrames).map(
      (element) => `${relativeToSrc(file)}: ${element}`
    )
  )
  expect(violations).toEqual([])
})

test("pressablesWithoutCursor checks tamagui primitives and styled frames", () => {
  expect(
    pressablesWithoutCursor(
      "example.tsx",
      `import { Text, type View as V, XStack } from "tamagui"
        const Bare = styled(View, { h: 8 })
        const Pointer = styled(View, { h: 8, cursor: "web:pointer" })
        const a = <XStack onPress={go} />
        const b = <Text cursor="web:pointer" onPress={go} />
        const c = <Bare onPress={go}>x</Bare>
        const d = <Bare cursor="web:pointer" onPress={go} />
        const e = <Pointer onPress={go} />
        const f = <Button onPress={go} />
        const g = <Bare />
        const h = <Shell onPress={go} />
        const i = <V onPress={go} />
      `,
      new Map([["Shell", false]])
    )
  ).toEqual(["XStack at line 4", "Bare at line 6", "Shell at line 11"])
})

test("text fields pad with pl/pr, so a caller's inner icon padding wins", () => {
  // On native Tamagui expands `px` to paddingStart/End as well, and Yoga
  // prefers those over the caller's paddingLeft/Right.
  const violations = ["input.tsx", "textarea.tsx"].filter((file) =>
    /\bpx\s*[:=]/u.test(readFileSync(path.join(uiDir, file), "utf8"))
  )
  expect(violations).toEqual([])
})
