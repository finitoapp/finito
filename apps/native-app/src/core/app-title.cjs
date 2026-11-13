/**
 * The build channels Finito ships on (brand/0005): `production` on
 * app.finito.fit and the release APK/AAB, `edge` on edge.app.finito.fit,
 * `prev` on finito-edge's preview deployments, and `dev` for everything else
 * (Expo's dev server, a local web export, the debug APK).
 */
const appChannels = /** @type {const} */ (["production", "edge", "prev", "dev"])

/**
 * The name an installed app shows on a home screen: the brand's name, followed
 * by the channel unless it is production ("Finito", "Finito edge"). CommonJS so
 * that Expo's config plugins load it as they are, besides the web build script
 * and the app; `app-title.d.cts` types it.
 *
 * @param {string} brandName
 * @param {(typeof appChannels)[number]} channel
 * @returns {string}
 */
const appTitle = (brandName, channel) =>
  channel === "production" ? brandName : `${brandName} ${channel}`

module.exports = { appChannels, appTitle }
