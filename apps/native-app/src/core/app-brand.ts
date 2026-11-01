import { finitoBrand } from "@payky/app-shared/brand"
import { createDefaultEvoluTransportUrls } from "@payky/core/evolu/device-account"

/** The native app and its web export ship as Finito (brand/0001). */
export const appBrand = finitoBrand

/** The transports a new account on this device starts with. */
export const appDefaultTransports = createDefaultEvoluTransportUrls(
  appBrand.liveRelayHost
)
