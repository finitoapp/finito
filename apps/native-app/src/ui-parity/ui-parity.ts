import path from "node:path"
import ts from "typescript"

/**
 * Which kit components a screen renders, so a native screen can be checked
 * against the web screen it mirrors (`ui-parity-map.ts`). A kit component is
 * a JSX tag imported from `components/ui/*`, web's `components/reui/*`, or
 * one of the cross-feature root components both apps share by file name.
 * Names compare across apps as imported: web `Button` from `ui/button.tsx`
 * equals native `Button` from `components/ui/button.tsx`.
 */

/**
 * Web's cross-feature root components (`apps/web-app/src/components/*.tsx`,
 * minus the theme provider and the desktop phone frame). A native root
 * component counts as kit when it has the same file name.
 */
const rootKitModules = new Set([
  "collision-alert",
  "copyable-qr-code",
  "detail-row",
  "fade-header",
  "list-skeleton",
  "menu-nav",
  "not-found-card",
  "option-toggle-group",
  "password-textarea",
  "route-message",
  "scan-code-scanner",
  "scan-code-scanner-dialog",
  "scanner-torch-button",
  "search-input",
  "sliding-pill",
  "success-panel",
  "vertical-nav",
])

const srcRoots = ["apps/web-app/src", "apps/native-app/src"] as const

const srcRootOf = (file: string): string | undefined =>
  srcRoots.find((root) => file.startsWith(`${root}/`))

/** The module under `components/` a specifier names, e.g. `ui/button`. */
const kitModuleOf = (file: string, specifier: string): string | undefined => {
  const srcRoot = srcRootOf(file)
  if (srcRoot === undefined) return undefined
  const resolved = specifier.startsWith("@/")
    ? path.posix.join(srcRoot, specifier.slice(2))
    : specifier.startsWith(".")
      ? path.posix.join(path.posix.dirname(file), specifier)
      : undefined
  if (resolved === undefined) return undefined
  const module = path.posix
    .relative(`${srcRoot}/components`, resolved)
    .replace(/\.tsx?$/u, "")
  // Native `ui/icon` wraps a lucide icon, which web renders directly.
  if (module === "ui/icon") return undefined
  if (module.startsWith("ui/") || module.startsWith("reui/")) return module
  return rootKitModules.has(module) ? module : undefined
}

/**
 * Native kit members that draw what web renders as a plain lucide icon, so
 * they count no more than `ui/icon` does: `CollapsibleChevron` is web's
 * `ChevronDown` with a `rotate-180` class at each collapsible trigger.
 */
const iconKitNames = new Set(["CollapsibleChevron"])

export interface KitElement {
  readonly name: string
  readonly line: number
  /** How many kit elements enclose this one. */
  readonly depth: number
  /** `variant`, `size` and other string-literal props, and `t("key")` props. */
  readonly props: Readonly<Record<string, string>>
}

const importedKitNames = (
  file: string,
  sourceFile: ts.SourceFile
): ReadonlyMap<string, string> => {
  const names = new Map<string, string>()
  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.importClause?.isTypeOnly === true ||
      kitModuleOf(file, statement.moduleSpecifier.text) === undefined
    )
      continue
    const bindings = statement.importClause?.namedBindings
    if (bindings === undefined || !ts.isNamedImports(bindings)) continue
    for (const element of bindings.elements) {
      const name = (element.propertyName ?? element.name).getText(sourceFile)
      if (element.isTypeOnly || iconKitNames.has(name)) continue
      names.set(element.name.text, name)
    }
  }
  return names
}

const propValue = (
  initializer: ts.JsxAttributeValue | undefined,
  sourceFile: ts.SourceFile
): string | undefined => {
  if (initializer === undefined) return "true"
  if (ts.isStringLiteral(initializer)) return initializer.text
  if (!ts.isJsxExpression(initializer) || initializer.expression === undefined)
    return undefined
  const expression = initializer.expression
  if (ts.isStringLiteral(expression)) return expression.text
  if (
    ts.isCallExpression(expression) &&
    expression.expression.getText(sourceFile) === "t"
  ) {
    const key = expression.arguments[0]
    return key !== undefined && ts.isStringLiteral(key)
      ? `t(${key.text})`
      : undefined
  }
  return undefined
}

/** Every kit element `source` renders, in source order. */
export const kitElements = (
  file: string,
  source: string
): ReadonlyArray<KitElement> => {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  )
  const imported = importedKitNames(file, sourceFile)
  const elements: KitElement[] = []
  const visit = (node: ts.Node, depth: number): void => {
    const opening = ts.isJsxElement(node)
      ? node.openingElement
      : ts.isJsxSelfClosingElement(node)
        ? node
        : undefined
    const tag = opening?.tagName.getText(sourceFile).split(".")[0]
    const name = tag === undefined ? undefined : imported.get(tag)
    if (opening !== undefined && name !== undefined) {
      const props: Record<string, string> = {}
      for (const attribute of opening.attributes.properties) {
        if (!ts.isJsxAttribute(attribute)) continue
        const value = propValue(attribute.initializer, sourceFile)
        if (value !== undefined)
          props[attribute.name.getText(sourceFile)] = value
      }
      elements.push({
        name,
        line:
          sourceFile.getLineAndCharacterOfPosition(opening.getStart()).line + 1,
        depth,
        props,
      })
    }
    ts.forEachChild(node, (child) =>
      visit(child, name === undefined ? depth : depth + 1)
    )
  }
  visit(sourceFile, 0)
  return elements
}

/** The set of kit components `source` renders. */
export const kitComponents = (
  file: string,
  source: string
): ReadonlySet<string> =>
  new Set(kitElements(file, source).map((element) => element.name))
