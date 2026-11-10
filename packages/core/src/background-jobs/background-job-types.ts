import type { ConsoleDep, LockManagerDep, Task } from "@evolu/common"
import type { CashuBookingDeps } from "../cashu/cashu-booking.ts"
import type { CashuTokenListenerDeps } from "../cashu/cashu-token-listener.ts"
import type { CashuTopupDeps } from "../cashu/cashu-topup.ts"
import type {
  ConnectivityDep,
  DateDep,
  DeviceIdDep,
  EvoluOwnerDep,
  FetchDep,
  SelfPayDefaultRelaysDep,
  TableSelfPayRootDep,
} from "../deps.ts"
import type { EetApiDep } from "../integrations/eet/eet-client.ts"
import type { NostrRelayDep } from "../integrations/nostr/nostr-relay-client.ts"
import type { QerkoApiDep } from "../integrations/qerko/qerko-client.ts"
import type { QerkoConnectionStatusDep } from "../integrations/qerko/qerko-connection-status.ts"
import type { QerkoSocketDep } from "../integrations/qerko/qerko-socket.ts"
import type { YadioApiDep } from "../integrations/yadio/yadio-client.ts"
import type {
  DeviceAccountDep,
  EvoluDep,
} from "../modules/shared/evolu-deps.ts"
import type { SparkWalletDep } from "../spark/spark-wallet.ts"
import type { NotificationsDep } from "./notifications.ts"

export interface BackgroundJobOnErrorDep {
  readonly onError: (error: unknown) => void
}

export type BackgroundJobContext = EvoluDep &
  EvoluOwnerDep &
  ConsoleDep &
  DateDep &
  FetchDep &
  LockManagerDep &
  NotificationsDep &
  BackgroundJobOnErrorDep

export type BackgroundJob = Task<AsyncDisposable, never, BackgroundJobContext>

export type AppBackgroundJobContext = BackgroundJobContext &
  DeviceIdDep &
  ConnectivityDep &
  EetApiDep &
  NostrRelayDep &
  QerkoApiDep &
  QerkoSocketDep &
  QerkoConnectionStatusDep &
  SelfPayDefaultRelaysDep &
  SparkWalletDep &
  TableSelfPayRootDep &
  YadioApiDep

/** What the app's own runs add for the shared Cashu wallet. */
export type CashuBackgroundJobContext = AppBackgroundJobContext &
  DeviceAccountDep &
  CashuTopupDeps &
  CashuBookingDeps &
  CashuTokenListenerDeps

export type CashuBackgroundJob = Task<
  AsyncDisposable,
  never,
  CashuBackgroundJobContext
>

export type AppBackgroundJob = Task<
  AsyncDisposable,
  never,
  AppBackgroundJobContext
>

/**
 * A job of the apps, which also hand over this device's own database. The
 * CLI has none (account/0010), so the jobs it runs never ask for it.
 */
export type AppDeviceBackgroundJob = Task<
  AsyncDisposable,
  never,
  AppBackgroundJobContext & DeviceAccountDep
>
