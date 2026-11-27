const fs = require("node:fs")
const path = require("node:path")

// Every file of every `@noble/hashes`, as Metro names a module: by its real
// path in Bun's store (`metro.config.js`).
module.exports = fs
  .globSync(
    path.join(
      __dirname,
      "../../node_modules/.bun/@noble+hashes@*/node_modules/@noble/hashes/**/*.js"
    )
  )
  .map((file) => fs.realpathSync(file))
