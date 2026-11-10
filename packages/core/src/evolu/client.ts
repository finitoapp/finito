import {
  AppName,
  type AppOwner,
  createAppOwner,
  createEvolu,
  type EvoluConfig,
  testAppOwner,
} from "@evolu/common"
import {
  deriveEvoluOwnerSecret,
  type MasterKey,
} from "../modules/shared/key-derivation.ts"
import { AppSchema, createAppIndexes } from "./schema.ts"

/**
 * Config fields callers may set. `appOwner`, `appName`, and `indexes` are
 * owned by this factory.
 */
type AppEvoluConfig = Omit<EvoluConfig, "appOwner" | "appName" | "indexes">
type AppEvoluAccountConfig = AppEvoluConfig & {
  readonly masterKey: MasterKey
  readonly transports: NonNullable<EvoluConfig["transports"]>
}

const createAppEvoluWithOwner = (appOwner: AppOwner, config: AppEvoluConfig) =>
  createEvolu(AppSchema, {
    ...config,
    appName: AppName.orThrow("Payky"),
    appOwner,
    indexes: createAppIndexes,
  })

export const deriveAppOwner = (masterKey: MasterKey): AppOwner =>
  createAppOwner(deriveEvoluOwnerSecret(masterKey))

export const createAppEvolu = ({
  masterKey,
  ...config
}: AppEvoluAccountConfig) =>
  createAppEvoluWithOwner(deriveAppOwner(masterKey), config)

/**
 * App Evolu owned by the publicly known Evolu test owner. Only for tests and
 * a CLI started without a recovery phrase — never for the app itself.
 */
export const createTestAppEvolu = (config: AppEvoluConfig = {}) =>
  createAppEvoluWithOwner(testAppOwner, { transports: [], ...config })
