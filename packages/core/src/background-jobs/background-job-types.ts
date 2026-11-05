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
} from "../deps.ts"
import type { EetApiDep } from "../integrations/eet/eet-client.ts"
import type { QerkoApiDep } from "../integrations/qerko/qerko-client.ts"
import type { QerkoConnectionStatusDep } from "../integrations/qerko/qerko-connection-status.ts"
import type { QerkoSocketDep } from "../integrations/qerko/qerko-socket.ts"
import type { EvoluDep } from "../modules/shared/evolu-deps.ts"

export interface BackgroundJobOnErrorDep {
  readonly onError: (error: unknown) => void
}

export type BackgroundJobContext = EvoluDep &
  EvoluOwnerDep &
  ConsoleDep &
  DateDep &
  FetchDep &
  LockManagerDep &
  BackgroundJobOnErrorDep

export type BackgroundJob = Task<AsyncDisposable, never, BackgroundJobContext>

export type AppBackgroundJobContext = BackgroundJobContext &
  DeviceIdDep &
  ConnectivityDep &
  EetApiDep &
  QerkoApiDep &
  QerkoSocketDep &
  QerkoConnectionStatusDep

/** What the app's own runs add for the shared Cashu wallet. */
export type CashuBackgroundJobContext = AppBackgroundJobContext &
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
