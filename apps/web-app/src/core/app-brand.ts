import { brandDefaultTransports, paykyBrand } from "@payky/app-shared/brand"

/** The web app and its Capacitor shell ship as Payky (brand/0001). */
export const appBrand = paykyBrand

/** The transports a new account on this device starts with. */
export const appDefaultTransports = brandDefaultTransports(appBrand)
