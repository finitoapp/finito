import {
  AppName,
  type Evolu as BaseEvolu,
  createAppOwner,
  createEvolu,
  createIdFromString,
  createQueryBuilder,
  type Evolu,
  type EvoluDeps,
  id,
  OwnerSecret,
  ok,
  sqliteFalse,
  type Task,
} from "@evolu/common"
import { z } from "zod"
import { DeviceId } from "../modules/device/device-types.ts"
import { MasterKeySchema } from "../modules/shared/key-derivation.ts"
import {
  type InferTable,
  NonEmptyString255Schema,
  NonNegativeIntegerSchema,
  TimestampMsSchema,
  WssUrlSchema,
} from "../modules/shared/schema.ts"
import { standardSchemaToZod } from "../zod-utils.ts"

/** SQLite's 0/1 boolean, as the device tables store their flags. */
const SqliteBoolSchema = z.union([z.literal(0), z.literal(1)])

export const DeviceAccountIdRaw = id("DeviceAccountId")
export const DeviceAccountId = standardSchemaToZod(DeviceAccountIdRaw)
export type DeviceAccountId = typeof DeviceAccountIdRaw.Output

export const AccountEvoluTransportIdRaw = id("DeviceAccountEvoluTransportId")
export const AccountEvoluTransportId = standardSchemaToZod(
  AccountEvoluTransportIdRaw
)
export type AccountEvoluTransportId = typeof AccountEvoluTransportIdRaw.Output

export const DeviceSettingsIdRaw = id("DeviceSettings")
export const DeviceSettingsId = standardSchemaToZod(DeviceSettingsIdRaw)
export type DeviceSettingsId = typeof DeviceSettingsIdRaw.Output

export const PinAttemptIdRaw = id("PinAttempt")
export const PinAttemptId = standardSchemaToZod(PinAttemptIdRaw)
export type PinAttemptId = typeof PinAttemptIdRaw.Output

export const PinAttemptBaseIdRaw = id("PinAttemptBase")
export const PinAttemptBaseId = standardSchemaToZod(PinAttemptBaseIdRaw)
export type PinAttemptBaseId = typeof PinAttemptBaseIdRaw.Output

export const CashuCounterIdRaw = id("CashuCounter")
export const CashuCounterId = standardSchemaToZod(CashuCounterIdRaw)
export type CashuCounterId = typeof CashuCounterIdRaw.Output

export const CashuClaimAttemptIdRaw = id("CashuClaimAttempt")
export const CashuClaimAttemptId = standardSchemaToZod(CashuClaimAttemptIdRaw)
export type CashuClaimAttemptId = typeof CashuClaimAttemptIdRaw.Output

export const CashuKnownMintIdRaw = id("CashuKnownMint")
export const CashuKnownMintId = standardSchemaToZod(CashuKnownMintIdRaw)
export type CashuKnownMintId = typeof CashuKnownMintIdRaw.Output

export const QerkoTerminalSelectionIdRaw = id("QerkoTerminalSelection")
export const QerkoTerminalSelectionId = standardSchemaToZod(
  QerkoTerminalSelectionIdRaw
)
export type QerkoTerminalSelectionId = typeof QerkoTerminalSelectionIdRaw.Output

export const deviceSettingsId = createIdFromString<"DeviceSettings">(
  "payky-device-settings"
)

const DemoAccountStateSchema = z.enum(["pending", "seeded"])
export type DemoAccountState = z.output<typeof DemoAccountStateSchema>

const DeviceLanguageSchema = z.enum(["en", "cs", "sk"])
const DeviceThemeSchema = z.enum(["system", "light", "dark"])
const DeviceLocaleSchema = z.enum(["cs-CZ", "en-US", "sk-SK"])
/**
 * What the AI assistant may send off the device (ai/0004): nothing, Payky's
 * public documentation and code, or the merchant's data as well.
 */
const AiAssistantAccessSchema = z.enum(["off", "public", "all"])

export type DeviceLanguage = z.output<typeof DeviceLanguageSchema>
export type DeviceTheme = z.output<typeof DeviceThemeSchema>
export type DeviceLocale = z.output<typeof DeviceLocaleSchema>
export type AiAssistantAccess = z.output<typeof AiAssistantAccessSchema>

export interface DeviceSettings {
  readonly id: DeviceSettingsId
  readonly language: DeviceLanguage
  readonly theme: DeviceTheme
  readonly locale: DeviceLocale
  readonly errorReportingEnabled: 0 | 1
  readonly productLookupEnabled: 0 | 1
  readonly aiAssistantAccess: AiAssistantAccess
}

const deviceEvoluSchema = {
  account: {
    id: DeviceAccountId,
    name: NonEmptyString255Schema,
    masterKey: MasterKeySchema,
    lastUseAt: TimestampMsSchema,
    /**
     * The account's Nostr picture as last seen while it was active, so the
     * account list shows it without asking relays about inactive accounts.
     */
    nostrPicture: z.string().max(2048).nullable(),
    /**
     * Set only on a demo account (demo-data/0001): `pending` until its
     * fictional history has been generated, then `seeded`. A demo account
     * never syncs and runs no background jobs.
     */
    demo: DemoAccountStateSchema.nullable(),
    /**
     * Until when the recovery-phrase backup reminder stays away on this
     * device (account/0007); `null` until it is first dismissed.
     */
    backupReminderSnoozedUntil: TimestampMsSchema.nullable(),
  },
  accountEvoluTransport: {
    id: AccountEvoluTransportId,
    accountId: DeviceAccountId,
    type: z.enum(["WebSocket"]),
    isActive: SqliteBoolSchema,
  },
  accountEvoluTransportWebsocket: {
    id: AccountEvoluTransportId,
    url: WssUrlSchema,
  },
  device: {
    id: DeviceId,
    name: NonEmptyString255Schema,
    deviceType: z.string().nullable(),
    deviceVendor: z.string().nullable(),
    browserName: z.string().nullable(),
    osName: z.string().nullable(),
  },
  /**
   * The failed PIN attempt log, per account (access/0006): local to this
   * device, so blocking on one account leaves its other accounts alone.
   */
  pinAttempt: {
    id: PinAttemptId,
    accountId: DeviceAccountId,
    attemptedAt: TimestampMsSchema,
    /** What the attempt tried to unlock: a route path or an action key. */
    target: NonEmptyString255Schema,
  },
  /**
   * Per account: the last unblock token applied and the log length at that
   * point. Only attempts after it count towards the block (access/0006).
   */
  pinAttemptBase: {
    id: PinAttemptBaseId,
    accountId: DeviceAccountId,
    unblockToken: NonEmptyString255Schema.nullable(),
    baseCount: NonNegativeIntegerSchema,
  },
  /**
   * NUT-13 counters of the shared Cashu wallet, per account and
   * `mint|unit|keysetId` (cashu.md §3): the next free derivation slot. Local
   * to this device on purpose, as Linky keeps its own; never moves back.
   */
  cashuCounter: {
    id: CashuCounterId,
    accountId: DeviceAccountId,
    scope: z.string().min(1).max(1200),
    next: NonNegativeIntegerSchema,
  },
  /**
   * The counter this device reserved for a Cashu operation's claim or swap:
   * the one way to tell its own attempt from someone else's synced counter
   * (decision 11).
   */
  cashuClaimAttempt: {
    id: CashuClaimAttemptId,
    accountId: DeviceAccountId,
    operationId: z.string().min(1).max(100),
    counter: NonNegativeIntegerSchema,
  },
  /**
   * Mints this device has loaded (`seen`) or the merchant added by URL
   * (`added`), per account; with the mints proofs and operations name, they
   * are the known mints (Linky's `knownMints`). Removing a mint tombstones
   * its rows.
   */
  cashuKnownMint: {
    id: CashuKnownMintId,
    accountId: DeviceAccountId,
    mint: z.string().min(1).max(1000),
    seen: SqliteBoolSchema.nullable(),
    added: SqliteBoolSchema.nullable(),
  },
  /**
   * The Qerko terminal this device pays on, per account (qerko/0001): the
   * API key syncs with the account, but which terminal sits on which counter
   * is a fact about the device. `terminalTid` and `locationName` are what
   * the settings screen shows without asking Qerko.
   */
  qerkoTerminalSelection: {
    id: QerkoTerminalSelectionId,
    accountId: DeviceAccountId,
    terminalId: NonEmptyString255Schema,
    terminalTid: NonEmptyString255Schema,
    locationName: NonEmptyString255Schema,
  },
  deviceSettings: {
    id: DeviceSettingsId,
    language: DeviceLanguageSchema.nullable(),
    theme: DeviceThemeSchema.nullable(),
    locale: DeviceLocaleSchema.nullable(),
    errorReportingEnabled: SqliteBoolSchema.nullable(),
    productLookupEnabled: SqliteBoolSchema.nullable(),
    aiAssistantAccess: AiAssistantAccessSchema.nullable(),
    /**
     * Whether a browser on this device may call services that answer no CORS
     * preflight (Fio, MONETA) through the app's own proxy. `null` — what
     * every device has until the merchant chooses — means off, so it is left
     * out of `DeviceSettings` and of the defaults seeding and onboarding
     * write; read it through `isServiceProxyEnabled`.
     */
    serviceProxyEnabled: SqliteBoolSchema.nullable(),
  },
} as const

export type DeviceSettingsRow = InferTable<
  (typeof deviceEvoluSchema)["deviceSettings"]
>

const deviceLocaleByLanguage = {
  en: "en-US",
  cs: "cs-CZ",
  sk: "sk-SK",
} satisfies Record<DeviceLanguage, DeviceLocale>

export function getDeviceLocaleForLanguage(
  language: DeviceLanguage
): DeviceLocale {
  return deviceLocaleByLanguage[language]
}

export function createDefaultDeviceSettings(
  language: DeviceLanguage = "en"
): DeviceSettings {
  return {
    id: deviceSettingsId,
    language,
    theme: "system",
    locale: getDeviceLocaleForLanguage(language),
    errorReportingEnabled: sqliteFalse,
    productLookupEnabled: sqliteFalse,
    aiAssistantAccess: "off",
  }
}

export const createDeviceQuery = createQueryBuilder(deviceEvoluSchema)

// Currently a static ownerSecret. Plan to migrate to WebAuthn+PRF, see
// https://github.com/finitoapp/payky/issues/5
const ownerSecret = OwnerSecret.orThrow(
  new Uint8Array([
    32, 99, 101, 230, 222, 46, 149, 166, 144, 165, 217, 240, 14, 24, 40, 8, 210,
    93, 169, 86, 19, 180, 45, 103, 217, 209, 37, 156, 30, 227, 201, 137,
  ])
)
const appOwner = createAppOwner(ownerSecret)

export const createDeviceEvolu: Task<
  Evolu<DeviceEvoluSchema>,
  never,
  EvoluDeps
> = async (run) => {
  const evolu = await run.ok(
    createEvolu(deviceEvoluSchema, {
      appName: AppName.orThrow("PaykyDevice"),
      appOwner,
      transports: [], // Disable syncing for now
      indexes: () => [],
    })
  )

  return ok(evolu)
}

export type DeviceEvoluSchema = typeof deviceEvoluSchema
export type DeviceEvolu = BaseEvolu<DeviceEvoluSchema>
