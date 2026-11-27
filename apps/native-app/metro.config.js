const { getDefaultConfig } = require("expo/metro-config")
const path = require("node:path")

const config = getDefaultConfig(__dirname)

// Workspace packages (@payky/app-shared) declare react, jotai and TanStack
// Query as peers, so Bun gives them their own copy, bound to the web app's
// React; a second copy in the bundle breaks hooks, the jotai store and the
// QueryClient context ("No QueryClient set"). Resolve every such peer from
// this app for every importer, taking the list from the package itself so a
// new peer is covered without touching this file.
const appOrigin = path.join(__dirname, "package.json")
const sharedPeers = Object.keys(
  require("../../packages/app-shared/package.json").peerDependencies
)
const isSharedPeer = (moduleName) =>
  sharedPeers.some(
    (peer) => moduleName === peer || moduleName.startsWith(`${peer}/`)
  )
// The Spark SDK's secp256k1 (`@noble/curves` 1.x, which its `@scure/bip32` and
// `@scure/btc-signer` share) is BigInt arithmetic, which held a payment
// terminal's JS thread for ~18 s at start and again after each received
// payment. On Android every import of it gets `spark-noble-secp256k1.ts`,
// which computes the costly point operations on Quick Crypto, and reaches the
// module itself as `spark-noble-secp256k1`.
const sparkSecp256k1 = path.join(
  __dirname,
  "src/platform/spark-noble-secp256k1.ts"
)
const coreOrigin = path.join(__dirname, "../../packages/core/package.json")
const resolveSparkNoble = (context, platform) => {
  const spark = context.resolveRequest(
    { ...context, originModulePath: coreOrigin },
    "@buildonspark/spark-sdk",
    platform
  )
  return context.resolveRequest(
    { ...context, originModulePath: spark.filePath },
    "@noble/curves/secp256k1",
    platform
  )
}
let sparkNoblePath = null

config.resolver.assetExts.push("wasm")
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "android" && moduleName === "spark-noble-secp256k1")
    return resolveSparkNoble(context, platform)
  // @evolu/sqlite-wasm finds its binary at `new URL("../wasm/sqlite3.wasm",
  // import.meta.url)`, which Metro neither emits nor can resolve in a worker.
  // On web its WasmUrl.js is swapped for one that requires the binary as an
  // asset, which Metro emits and returns the URL of.
  if (
    platform === "web" &&
    moduleName === "./WasmUrl.js" &&
    context.originModulePath.includes(
      `${path.sep}@evolu${path.sep}sqlite-wasm${path.sep}`
    )
  )
    return {
      type: "sourceFile",
      filePath: path.join(__dirname, "src/platform/sqlite-wasm-url.web.ts"),
    }
  if (moduleName === "@evolu/sqlite-wasm/sqlite3.wasm") {
    const entry = context.resolveRequest(
      context,
      "@evolu/sqlite-wasm",
      platform
    )
    return {
      type: "assetFiles",
      filePaths: [
        path.join(path.dirname(entry.filePath), "../wasm/sqlite3.wasm"),
      ],
    }
  }
  const fromApp = isSharedPeer(moduleName)
    ? { ...context, originModulePath: appOrigin }
    : context
  // @evolu/web names its workers `new URL("Db.worker.js", import.meta.url)`,
  // which a browser and Vite read as relative and Metro as a package name.
  const evoluWorker =
    /^(Db|Shared)\.worker\.js$/.test(moduleName) &&
    context.originModulePath.includes(
      `${path.sep}@evolu${path.sep}web${path.sep}`
    )
  const resolution = fromApp.resolveRequest(
    fromApp,
    evoluWorker ? `./${moduleName}` : moduleName,
    platform
  )
  if (platform === "android" && moduleName.startsWith("@noble/curves")) {
    sparkNoblePath ??= resolveSparkNoble(context, platform).filePath
    if (resolution.filePath === sparkNoblePath)
      return { type: "sourceFile", filePath: sparkSecp256k1 }
  }
  return resolution
}

// Evaluates a module where it is first used rather than when the bundle
// loads: a cold start otherwise ran every route's module graph before the
// first screen (~0.2 s on the test phone). Side-effect imports, such as the
// polyfills entry.ts loads first, keep their place.
config.transformer.getTransformOptions = async () => ({
  transform: { experimentalImportSupport: true, inlineRequires: true },
})

module.exports = config
