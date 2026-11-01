import { paykyBrand } from "@payky/app-shared/brand"
import { createDefaultEvoluTransportUrls } from "@payky/core/evolu/device-account"

/** The web app and its Capacitor shell ship as Payky (brand/0001). */
export const appBrand = paykyBrand

/** The transports a new account on this device starts with. */
export const appDefaultTransports = createDefaultEvoluTransportUrls(
  appBrand.liveRelayHost
)
