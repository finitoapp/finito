import { brandDefaultTransports, finitoBrand } from "@payky/app-shared/brand"

/** The native app and its web export ship as Finito (brand/0001). */
export const appBrand = finitoBrand

/** The transports a new account on this device starts with. */
export const appDefaultTransports = brandDefaultTransports(appBrand)
