import type {
  Permission,
  RouteAccess,
} from "@payky/core/modules/access/access-types"

export type NativeRoutePath =
  | "/"
  | "/diagnostics"
  | "/error"
  | "/e2e/:action"
  | "/onboarding"
  | "/restore-account"
  | "/bill"
  | "/payment/tip"
  | "/payment/:paymentId"
  | "/activity"
  | "/activity/bills"
  | "/activity/stats"
  | "/activity/bills/:billId"
  | "/activity/:paymentId"
  | "/withdraw"
  | "/withdraw/new"
  | "/withdraw/:withdrawalId"
  | "/cashu-withdraw"
  | "/cashu-withdraw/new"
  | "/cashu-withdraw/:withdrawalId"
  | "/settings"
  | "/settings/debug-console"
  | "/settings/support"
  | "/settings/assistant"
  | "/settings/demo-data"
  | "/settings/donations"
  | "/settings/donations-invoice"
  | "/settings/about"
  | "/settings/about/terms"
  | "/settings/about/privacy"
  | "/settings/language"
  | "/settings/theme"
  | "/notifications"
  | "/settings/home-screen"
  | "/settings/profile"
  | "/settings/tax-rates"
  | "/settings/tips"
  | "/settings/payment-number-series"
  | "/settings/items"
  | "/settings/items/new"
  | "/settings/items/:catalogItemId"
  | "/settings/tables"
  | "/settings/tables/new"
  | "/settings/tables/:tableId"
  | "/settings/accounts"
  | "/settings/accounts/open"
  | "/settings/eet"
  | "/settings/access"
  | "/settings/access/add-device"
  | "/settings/security"
  | "/settings/security/backup"
  | "/settings/evolu-export"
  | "/settings/payment-accounts"
  | "/settings/payment-accounts/iban"
  | "/settings/payment-accounts/iban/fio-plugin"
  | "/settings/payment-accounts/iban/moneta-plugin"
  | "/settings/payment-accounts/cashu"
  | "/settings/payment-accounts/cashu/mints"
  | "/settings/payment-accounts/cashu/payment-qr"
  | "/settings/payment-accounts/cashu/mints/new"
  | "/settings/payment-accounts/cashu/mints/:mint"
  | "/settings/payment-accounts/spark"
  | "/settings/payment-accounts/spark/transactions"
  | "/settings/payment-accounts/card-switchio"
  | "/settings/payment-accounts/qerko-terminal"
  | "/settings/payment-accounts/qerko-payment"
  | "/settings/payment-accounts/lightning-address"
  | "/settings/payment-accounts/bitcoin"

/**
 * What each Expo Router path needs (access/0003); `route-access.test.ts`
 * keeps it in step with `app/`. `/` is the terminal home and needs `sell`
 * like web's `_terminal/` index (access/0002); `/diagnostics` is
 * owner-level until R03 replaces them. No route group exists yet; when one does, add the
 * "a `free` child under a gated group fails" check to the test (access/0003).
 */
export const routeAccess = {
  "/": "sell",
  "/diagnostics": "admin",
  // Like web's /onboarding, outside the gated `_terminal` layout: a fresh
  // account has no PIN yet.
  "/onboarding": "free",
  // Like web's /restore-account, a sibling of /onboarding outside `_terminal`.
  "/restore-account": "free",
  // Like web's `_terminal/bill` (access/0002: the bill is `sell`).
  "/bill": "sell",
  // Like web's `_terminal/payment/tip` and `payment_/$paymentId`.
  "/payment/tip": "sell",
  "/payment/:paymentId": "sell",
  // Like web's `_terminal/activity` routes (access/0002: history is `activity`).
  "/activity": "activity",
  "/activity/bills": "activity",
  "/activity/bills/:billId": "activity",
  "/activity/:paymentId": "activity",
  // Like web's `_terminal/activity_/stats` (access/0010), Activity's third tab.
  "/activity/stats": "stats",
  // Like web's Spark `withdrawals` routes (access/0002: owner-only).
  "/withdraw": "admin",
  "/withdraw/new": "admin",
  "/withdraw/:withdrawalId": "admin",
  // Like web's Cashu `withdrawals` routes: the same owner-only gate (access/0002).
  "/cashu-withdraw": "admin",
  "/cashu-withdraw/new": "admin",
  "/cashu-withdraw/:withdrawalId": "admin",
  // Like web's `_terminal/settings/` index: the menu is free, each destination has its own gate.
  "/settings": "free",
  // Like web's `_terminal/settings/assistant` (access/0002: `activity`); the screen itself needs the device's consent (ai/0004).
  "/settings/assistant": "activity",
  // Like web's `_terminal/settings/support` (access/0002: `settings`).
  "/settings/support": "settings",
  // Like web's `_terminal/settings/debug-console`: logs can name owners and relays, owner-only.
  "/settings/debug-console": "admin",
  // Like web's `_terminal/settings/demo-data`: creates an account, owner-only.
  "/settings/demo-data": "admin",
  // Like web's `_terminal/settings/donations*`: donating spends no shop money, free.
  "/settings/donations": "free",
  "/settings/donations-invoice": "free",
  // About exposes only public build metadata and links to no gated feature.
  "/settings/about": "free",
  // Terms are public text, like the web About child route.
  "/settings/about/terms": "free",
  // Like web's `_terminal/settings/about/privacy`: a device consent, free (access/0002).
  "/settings/about/privacy": "free",
  // Like web's `_terminal/settings/language`.
  "/settings/language": "free",
  // Like web's `_terminal/settings/theme`.
  "/settings/theme": "free",
  // Web's `_terminal/notifications`, a tab on native (navigation/0004): nothing to protect yet (access/0010).
  "/notifications": "free",
  // Web's `_terminal/settings/home-screen`, the modes home offers (navigation/0004; access/0002: `settings`).
  "/settings/home-screen": "settings",
  // Like web's `_terminal/settings/profile`: the public profile is owner-only (access/0002).
  "/settings/profile": "admin",
  // Like web's `_terminal/settings/tax-rates` (access/0002: `settings`).
  "/settings/tax-rates": "settings",
  // Like web's `_terminal/settings/tips` (access/0002: `settings`).
  "/settings/tips": "settings",
  // Like web's `_terminal/settings/payment-number-series` (access/0002: `settings`).
  "/settings/payment-number-series": "settings",
  // Web's `_terminal/catalog/items`, under Settings on native (navigation/0004; access/0010: `catalog`).
  "/settings/items": "catalog",
  "/settings/items/new": "catalog",
  "/settings/items/:catalogItemId": "catalog",
  // Web's `_terminal/catalog/tables`, under Settings on native (navigation/0004; access/0010: `catalog`).
  "/settings/tables": "catalog",
  "/settings/tables/new": "catalog",
  "/settings/tables/:tableId": "catalog",
  // Like web's `_terminal/settings/access`: the Access section is owner-only (access/0002).
  // Like web's `_terminal/settings/accounts`: switching and removing accounts is owner-only.
  "/settings/accounts": "admin",
  // Adds an account the user already has (onboarding/0011); owner-only like the accounts screen.
  "/settings/accounts/open": "admin",
  // Like web's `_terminal/settings/eet`: fiscal reporting is owner-only.
  "/settings/eet": "admin",
  "/settings/access": "admin",
  // Like web's `_terminal/settings/access_/add-device`: sends the account away, owner-only.
  "/settings/access/add-device": "admin",
  // Like web's `_terminal/settings/security`: the recovery phrase and sync relays are owner-only.
  "/settings/security": "admin",
  // Like web's `_terminal/settings/security_/backup`: the recovery phrase is owner-only.
  "/settings/security/backup": "admin",
  // Like web's `_terminal/settings/evolu-export`: owner-only, and the export asks again before serializing.
  "/settings/evolu-export": "admin",
  // Like web's `_terminal/settings/payment-accounts` (owner-only, access/0002).
  "/settings/payment-accounts": "admin",
  // Like web's `_terminal/settings/payment-accounts/iban` (owner-only).
  "/settings/payment-accounts/iban": "admin",
  // Like web's `_terminal/settings/payment-accounts/iban/fio-plugin` (owner-only).
  "/settings/payment-accounts/iban/fio-plugin": "admin",
  // Like web's `_terminal/settings/payment-accounts/iban/moneta-plugin` (owner-only).
  "/settings/payment-accounts/iban/moneta-plugin": "admin",
  // Like web's `_terminal/settings/payment-accounts/cashu` (access/0009).
  "/settings/payment-accounts/cashu": "admin",
  // Like web's `_terminal/settings/payment-accounts/cashu/mints` (access/0009).
  "/settings/payment-accounts/cashu/mints": "admin",
  // The wallet's QR choice (settings/0003), owner-only as the wallet itself.
  "/settings/payment-accounts/cashu/payment-qr": "admin",
  // Like web's `_terminal/settings/payment-accounts/cashu/mints/new` (access/0009).
  "/settings/payment-accounts/cashu/mints/new": "admin",
  // Like web's `_terminal/settings/payment-accounts/cashu/mints/$mint` (access/0009).
  "/settings/payment-accounts/cashu/mints/:mint": "admin",
  // Like web's `_terminal/settings/payment-accounts/spark` (owner-only).
  "/settings/payment-accounts/spark": "admin",
  // Like web's `_terminal/settings/payment-accounts/spark/transactions` (owner-only).
  "/settings/payment-accounts/spark/transactions": "admin",
  // Like web's `_terminal/settings/payment-accounts/card-switchio` (owner-only).
  "/settings/payment-accounts/card-switchio": "admin",
  // Like web's `_terminal/settings/payment-accounts/qerko-terminal` (owner-only).
  "/settings/payment-accounts/qerko-terminal": "admin",
  // Like web's `_terminal/settings/payment-accounts/qerko-payment` (owner-only).
  "/settings/payment-accounts/qerko-payment": "admin",
  // Like web's `_terminal/settings/payment-accounts/lightning-address` (owner-only).
  "/settings/payment-accounts/lightning-address": "admin",
  // Finito's one Bitcoin method over the three wallets above (settings/0002): the same owner-only gate.
  "/settings/payment-accounts/bitcoin": "admin",
  // Like web's /error: a deliberate crash with no gate in front of it.
  "/error": "free",
  // The e2e bridge (src/e2e); it only redirects home outside an e2e build.
  "/e2e/:action": "free",
} satisfies Record<NativeRoutePath, RouteAccess>

const table: Readonly<Record<string, RouteAccess>> = routeAccess

/** `/payment/:paymentId` matches `/payment/abc`: a `:param` is any one segment. */
const matchesPattern = (pattern: string, pathname: string): boolean => {
  const want = pattern.split("/")
  const got = pathname.split("/")
  return (
    want.length === got.length &&
    want.every((part, i) =>
      part.startsWith(":") ? got[i] !== "" : part === got[i]
    )
  )
}

/**
 * Fail closed: a path missing from the table needs the owner permission. An
 * exact entry wins over a `:param` pattern, as Expo Router ranks a static
 * route above a dynamic one (`/payment/tip` over `/payment/:paymentId`, `/activity/bills` over `/activity/:paymentId`).
 */
export const resolveRouteAccess = (pathname: string): RouteAccess =>
  table[pathname] ??
  Object.entries(table).find(([pattern]) =>
    matchesPattern(pattern, pathname)
  )?.[1] ??
  "admin"

export const requiredPermission = (pathname: string): Permission | null => {
  const access = resolveRouteAccess(pathname)
  return access === "free" ? null : access
}

/**
 * The routes outside web's `_terminal` layout, and native's own
 * `/diagnostics`: the only ones an account that is not onboarded stays on.
 */
const outsideTerminal: ReadonlyArray<NativeRoutePath> = [
  "/onboarding",
  "/restore-account",
  "/error",
  "/e2e/:action",
  "/diagnostics",
]

/**
 * Whether `pathname` belongs to the terminal, which web's `_terminal` layout
 * shows only to an onboarded account. An unknown path counts as one.
 */
export const isTerminalRoute = (pathname: string): boolean =>
  !outsideTerminal.some((pattern) => matchesPattern(pattern, pathname))
