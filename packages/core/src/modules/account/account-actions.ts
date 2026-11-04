import {
  type InsertValues,
  type MutationOptions,
  ok,
  sqliteFalse,
  sqliteTrue,
  type Task,
  type UpdateValues,
} from "@evolu/common"
import type { RequireExactlyOne, Simplify } from "type-fest"
import { seedCashuDefaultMint } from "../../cashu/cashu-mints.ts"
import type { CashuPaymentRequestLegs } from "../../cashu/cashu-payment-request.ts"
import type { CashuShardStoreDep } from "../../cashu/cashu-shard-store.ts"
import type { DateDep, EvoluOwnerDep, MasterKeyDep } from "../../deps.ts"
import { defineError } from "../../error.ts"
import { updateFioPluginAccountRow } from "../fio-plugin/fio-plugin-actions.ts"
import { fioPluginByIdQuery } from "../fio-plugin/fio-plugin-queries.ts"
import { fioPluginId } from "../fio-plugin/fio-plugin-utils.ts"
import { updateMonetaPluginAccountRow } from "../moneta-plugin/moneta-plugin-actions.ts"
import { fiatBankAccountMonetaPluginQuery } from "../moneta-plugin/moneta-plugin-queries.ts"
import type { EvoluDep } from "../shared/evolu-deps.ts"
import {
  removeUndefinedValues,
  runMutationWithCompletion,
} from "../shared/evolu-utils.ts"
import {
  deriveDefaultSparkWalletSecret,
  type SparkMnemonic,
  type SparkSecret,
  sparkMnemonicToSecret,
} from "../shared/key-derivation.ts"
import { getFirstOr } from "../shared/result.ts"
import type { FiatCurrency, Iban, TimestampMs } from "../shared/schema.ts"
import { NonEmptyString255, TimestampMsSchema } from "../shared/schema.ts"
import type {
  AccountRow,
  account,
  accountCashRegister,
  accountIban,
  accountSpark,
} from "./account.ts"
import {
  accountByIdQuery,
  cardSwitchioAccountQuery,
  cashRegisterAccountQuery,
  cashuAccountQuery,
  fiatBankAccountQuery,
  lightningAddressAccountQuery,
  qerkoTerminalAccountQuery,
  sparkAccountQuery,
} from "./account-queries.ts"
import { sparkAccountSyncPointerByAccountIdQuery } from "./account-spark-queries.ts"
import type { AccountId, BankQrFormat } from "./account-types.ts"
import {
  createCardSwitchioAccountId,
  createCashRegisterAccountId,
  createCashuAccountId,
  createIbanAccountId,
  createLightningAddressAccountId,
  createQerkoTerminalAccountId,
  createSparkAccountId,
} from "./account-utils.ts"

type AccountIbanCreateInput = Omit<
  InsertValues<typeof accountIban>,
  "defaultQrFormat"
> & {
  readonly defaultQrFormat?: BankQrFormat
}

// `iban` and `currency` are left out because the account id derives from
// them — see `createIbanAccountId`.
type AccountIbanUpdateInput = Omit<
  UpdateValues<typeof accountIban>,
  "id" | "iban" | "currency" | "defaultQrFormat"
> & {
  readonly defaultQrFormat?: BankQrFormat
}

export const createAccountNotFoundError = defineError("AccountNotFound")<{
  readonly id: AccountId
}>()
export type AccountNotFoundError = ReturnType<typeof createAccountNotFoundError>

export const loadAccount =
  (idValue: AccountId): Task<AccountRow, AccountNotFoundError, EvoluDep> =>
  async (run) =>
    getFirstOr(
      await run.deps.evolu.loadQuery(accountByIdQuery(idValue)),
      createAccountNotFoundError({ id: idValue })
    )

/**
 * Which kind of account a write describes, from the one detail payload it
 * carries. Both `createAccount` and `updateAccount` take
 * `RequireExactlyOne`, so exactly one key is present and the order these are
 * checked in cannot matter; it is a plain function of the input rather than
 * something to accumulate while writing rows.
 */
const deriveAccountKind = (detail: {
  readonly iban?: unknown
  readonly spark?: unknown
  readonly cashRegister?: unknown
}): AccountRow["kind"] => {
  if (detail.iban) return "iban"
  if (detail.spark) return "spark"
  return "cashRegister"
}

const deriveNewAccountId = (
  detail: RequireExactlyOne<{
    iban: { readonly iban: Iban; readonly currency: FiatCurrency }
    spark: InsertValues<typeof accountSpark>
    cashRegister: InsertValues<typeof accountCashRegister>
  }>
): AccountId => {
  if (detail.iban) return createIbanAccountId(detail.iban)
  if (detail.spark) return createSparkAccountId(detail.spark.secret)
  return createCashRegisterAccountId(detail.cashRegister.currency)
}

/**
 * Writes the account its detail values derive to, reviving it when it was
 * deleted — creating an account that already exists is the same account,
 * not a second one.
 */
export const createAccount =
  (
    input: Simplify<
      Omit<InsertValues<typeof account>, "kind"> &
        RequireExactlyOne<{
          iban: AccountIbanCreateInput
          spark: InsertValues<typeof accountSpark>
          cashRegister: InsertValues<typeof accountCashRegister>
        }>
    >
  ): Task<AccountId, never, EvoluDep & EvoluOwnerDep> =>
  async (run) => {
    const { evoluOwner } = run.deps
    const { iban, spark, cashRegister, ...root } = input
    const id = deriveNewAccountId(input)

    const kind = deriveAccountKind({ iban, spark, cashRegister })

    await runMutationWithCompletion((options) => {
      if (iban) {
        run.deps.evolu.upsert(
          "accountIban",
          removeUndefinedValues({
            ...iban,
            id,
            defaultQrFormat: iban.defaultQrFormat ?? "spayd",
          }),
          { ...options, owner: evoluOwner }
        )
      }

      if (spark) {
        run.deps.evolu.upsert(
          "accountSpark",
          removeUndefinedValues({
            ...spark,
            id,
          }),
          { ...options, owner: evoluOwner }
        )
      }

      if (cashRegister) {
        run.deps.evolu.upsert(
          "accountCashRegister",
          removeUndefinedValues({
            ...cashRegister,
            id,
          }),
          { ...options, owner: evoluOwner }
        )
      }

      return run.deps.evolu.upsert(
        "account",
        removeUndefinedValues({
          ...root,
          id,
          kind,
          isDeleted: sqliteFalse,
        }),
        { ...options, owner: evoluOwner }
      )
    })

    return ok(id)
  }

/**
 * Edits what an account's id does not derive from. The Spark secret, the
 * IBAN and currency, and the cash register currency are not accepted here:
 * a different value is a different account, so it goes through
 * `createAccount` (or the `save*Account` actions) instead.
 */
export const updateAccount =
  ({
    iban,
    spark,
    cashRegister,
    ...input
  }: Simplify<
    Pick<UpdateValues<typeof account>, "id" | "deviceId" | "name"> &
      RequireExactlyOne<{
        iban: AccountIbanUpdateInput
        spark: Omit<UpdateValues<typeof accountSpark>, "id" | "secret">
        cashRegister: Omit<
          UpdateValues<typeof accountCashRegister>,
          "id" | "currency"
        >
      }>
  >): Task<AccountId, never, EvoluDep & EvoluOwnerDep> =>
  async (run) => {
    const { evoluOwner } = run.deps

    const kind = deriveAccountKind({ iban, spark, cashRegister })

    await runMutationWithCompletion((options) => {
      if (iban) {
        run.deps.evolu.update(
          "accountIban",
          removeUndefinedValues({
            ...iban,
            id: input.id,
            defaultQrFormat: iban.defaultQrFormat ?? "spayd",
          }),
          { ...options, owner: evoluOwner }
        )
      }

      if (spark) {
        run.deps.evolu.update(
          "accountSpark",
          removeUndefinedValues({
            ...spark,
            id: input.id,
          }),
          { ...options, owner: evoluOwner }
        )
      }

      if (cashRegister) {
        run.deps.evolu.update(
          "accountCashRegister",
          removeUndefinedValues({
            ...cashRegister,
            id: input.id,
          }),
          { ...options, owner: evoluOwner }
        )
      }

      return run.deps.evolu.update(
        "account",
        removeUndefinedValues({
          id: input.id,
          deviceId: input.deviceId,
          name: input.name,
          kind,
        }),
        { ...options, owner: evoluOwner }
      )
    })

    return ok(input.id)
  }

export const deleteAccount =
  (idValue: AccountId): Task<AccountId, never, EvoluDep & EvoluOwnerDep> =>
  async (run) => {
    const { evoluOwner } = run.deps

    await runMutationWithCompletion((options) =>
      run.deps.evolu.update(
        "account",
        {
          id: idValue,
          isDeleted: sqliteTrue,
        },
        { ...options, owner: evoluOwner }
      )
    )

    return ok(idValue)
  }

/**
 * Saves the fiat bank account the settings configure.
 *
 * Its id derives from the IBAN and currency, so a save that changes either
 * writes a different account. The one it replaces is retired in the same
 * batch, and the Fio and MONETA plugins — which always follow the fiat bank
 * account — are re-pointed with it. Returns `null` when no IBAN was ever configured and
 * none is given, as there is no account to write yet.
 */
export const saveFiatBankAccount =
  ({
    enabled,
    iban,
    currency,
    defaultQrFormat,
  }: {
    readonly enabled: boolean
    readonly iban?: Iban
    readonly currency: FiatCurrency
    readonly defaultQrFormat?: BankQrFormat
  }): Task<AccountId | null, never, EvoluDep & EvoluOwnerDep> =>
  async (run) => {
    const { evolu, evoluOwner } = run.deps

    const [current] = await evolu.loadQuery(fiatBankAccountQuery)
    const nextIban = iban ?? current?.iban
    if (nextIban === undefined) return ok(null)

    const id = createIbanAccountId({ iban: nextIban, currency })
    const [fioPlugin] = await evolu.loadQuery(fioPluginByIdQuery(fioPluginId))
    const [monetaPlugin] = await evolu.loadQuery(
      fiatBankAccountMonetaPluginQuery
    )

    await runMutationWithCompletion((options) => {
      const mutationOptions = { ...options, owner: evoluOwner }

      evolu.upsert(
        "accountIban",
        {
          id,
          iban: nextIban,
          currency,
          defaultQrFormat:
            defaultQrFormat ?? current?.defaultQrFormat ?? "spayd",
        },
        mutationOptions
      )

      if (current !== undefined && current.id !== id) {
        evolu.update(
          "account",
          { id: current.id, isDeleted: sqliteTrue },
          mutationOptions
        )
      }

      if (fioPlugin !== undefined && fioPlugin.accountId !== id) {
        updateFioPluginAccountRow(evolu, id, mutationOptions)
      }

      if (monetaPlugin !== undefined && monetaPlugin.accountId !== id) {
        updateMonetaPluginAccountRow(evolu, id, mutationOptions)
      }

      return evolu.upsert(
        "account",
        {
          id,
          deviceId: null,
          name: NonEmptyString255("Fiat bank account"),
          kind: "iban",
          isDeleted: enabled ? sqliteFalse : sqliteTrue,
        },
        mutationOptions
      )
    })

    return ok(id)
  }

/**
 * Saves the Spark account the settings configure, keeping whichever wallet it
 * already has and deriving the default one from the master key only when it
 * has none yet. Returns `null` when disabling a Spark account that never
 * existed, as there is nothing to write.
 */
export const saveSparkAccount =
  ({
    enabled,
  }: {
    readonly enabled: boolean
  }): Task<AccountId | null, never, EvoluDep & EvoluOwnerDep & MasterKeyDep> =>
  async (run) => {
    const { evolu, evoluOwner, masterKey } = run.deps

    // Preloaded so enabling Spark keeps the wallet already configured rather
    // than switching back to the default one.
    const [current] = await evolu.loadQuery(sparkAccountQuery)
    const secret =
      current?.secret ??
      (enabled ? deriveDefaultSparkWalletSecret(masterKey) : undefined)
    if (secret === undefined) return ok(null)

    const id = createSparkAccountId(secret)

    // Only a legacy account whose id predates derivation differs from `id`
    // here, so this retires nothing else.
    await runMutationWithCompletion((options) =>
      upsertSparkAccountRows(
        evolu,
        { id, secret, enabled, replacedId: current?.id },
        { ...options, owner: evoluOwner }
      )
    )

    return ok(id)
  }

/**
 * Writes the Spark account for `secret` and retires `replacedId`, the one it
 * takes over from, so at most one Spark account stays live.
 */
const upsertSparkAccountRows = (
  evolu: EvoluDep["evolu"],
  {
    id,
    secret,
    enabled,
    replacedId,
  }: {
    readonly id: AccountId
    readonly secret: SparkSecret
    readonly enabled: boolean
    readonly replacedId: AccountId | undefined
  },
  options: MutationOptions
): void => {
  evolu.upsert("accountSpark", { id, secret }, options)

  if (replacedId !== undefined && replacedId !== id) {
    evolu.update("account", { id: replacedId, isDeleted: sqliteTrue }, options)
  }

  evolu.upsert(
    "account",
    {
      id,
      deviceId: null,
      name: NonEmptyString255("Spark account"),
      kind: "spark",
      isDeleted: enabled ? sqliteFalse : sqliteTrue,
    },
    options
  )
}

/**
 * Switches Spark payments to the wallet behind `secret`, enabling Spark if it
 * was off. The previous wallet's account is retired and stops syncing:
 * invoices it issued that are still open are no longer detected, and its
 * balance is no longer shown — which the settings page warns about before
 * calling this. Switching back later revives the same account, with its sync
 * pointer and history.
 *
 * A wallet switched to for the first time gets its sync pointer set to now,
 * so its first sync looks back only the usual 72 hours instead of importing
 * the wallet's whole history as unmatched transactions.
 */
const selectSparkWallet =
  (
    secret: SparkSecret
  ): Task<AccountId, never, EvoluDep & EvoluOwnerDep & DateDep> =>
  async (run) => {
    const { evolu, evoluOwner } = run.deps
    const id = createSparkAccountId(secret)
    const [current] = await evolu.loadQuery(sparkAccountQuery)
    const [pointer] = await evolu.loadQuery(
      sparkAccountSyncPointerByAccountIdQuery(id)
    )

    await runMutationWithCompletion((options) => {
      const mutationOptions = { ...options, owner: evoluOwner }

      upsertSparkAccountRows(
        evolu,
        { id, secret, enabled: true, replacedId: current?.id },
        mutationOptions
      )

      if (pointer === undefined) {
        evolu.upsert(
          "sparkAccountSyncPointer",
          {
            id,
            lastSyncedAt: TimestampMsSchema.decode(
              run.deps.date.now().getTime()
            ),
            isDeleted: sqliteFalse,
          },
          mutationOptions
        )
      }
    })

    return ok(id)
  }

/** Switches Spark payments to a wallet the user brings as its 12 words. */
export const selectCustomSparkWallet = ({
  mnemonic,
}: {
  readonly mnemonic: SparkMnemonic
}): Task<AccountId, never, EvoluDep & EvoluOwnerDep & DateDep> =>
  selectSparkWallet(sparkMnemonicToSecret(mnemonic))

/** Switches Spark payments back to the wallet derived from the master key. */
export const selectDefaultSparkWallet =
  (): Task<
    AccountId,
    never,
    EvoluDep & EvoluOwnerDep & DateDep & MasterKeyDep
  > =>
  async (run) =>
    await run(
      selectSparkWallet(deriveDefaultSparkWalletSecret(run.deps.masterKey))
    )

/**
 * Saves the cash register the settings configure. Its id derives from the
 * currency, so enabling it in a different currency writes a different
 * account and retires the previous one in the same batch. Returns `null` when
 * disabling a cash register that never existed.
 */
export const saveCashRegisterAccount =
  ({
    enabled,
    currency,
  }: {
    readonly enabled: boolean
    readonly currency: FiatCurrency
  }): Task<AccountId | null, never, EvoluDep & EvoluOwnerDep> =>
  async (run) => {
    const { evolu, evoluOwner } = run.deps

    const [current] = await evolu.loadQuery(cashRegisterAccountQuery)

    if (!enabled) {
      if (current === undefined) return ok(null)

      await runMutationWithCompletion((options) =>
        evolu.update(
          "account",
          { id: current.id, isDeleted: sqliteTrue },
          { ...options, owner: evoluOwner }
        )
      )

      return ok(current.id)
    }

    const id = createCashRegisterAccountId(currency)

    await runMutationWithCompletion((options) => {
      const mutationOptions = { ...options, owner: evoluOwner }

      evolu.upsert("accountCashRegister", { id, currency }, mutationOptions)

      if (current !== undefined && current.id !== id) {
        evolu.update(
          "account",
          { id: current.id, isDeleted: sqliteTrue },
          mutationOptions
        )
      }

      return evolu.upsert(
        "account",
        {
          id,
          deviceId: null,
          name: NonEmptyString255("Cash register"),
          kind: "cashRegister",
          isDeleted: sqliteFalse,
        },
        mutationOptions
      )
    })

    return ok(id)
  }

/**
 * Updates or resets the Spark sync job's per-account high-water mark —
 * mirrors `updateFioPluginSyncPointer`. `null` soft-deletes the pointer row,
 * which makes the next sync a cold start (unbounded full history scan)
 * instead of resuming from a 72h lookback window.
 */
export const updateSparkAccountSyncPointer =
  ({
    id,
    lastSyncedAt,
  }: {
    readonly id: AccountId
    readonly lastSyncedAt: TimestampMs | null
  }): Task<AccountId, never, EvoluDep & EvoluOwnerDep> =>
  async (run) => {
    const { evoluOwner } = run.deps

    await runMutationWithCompletion((options) => {
      if (lastSyncedAt === null) {
        return run.deps.evolu.update(
          "sparkAccountSyncPointer",
          {
            id,
            isDeleted: sqliteTrue,
          },
          { ...options, owner: evoluOwner }
        )
      }

      return run.deps.evolu.upsert(
        "sparkAccountSyncPointer",
        {
          id,
          lastSyncedAt,
          isDeleted: sqliteFalse,
        },
        { ...options, owner: evoluOwner }
      )
    })

    return ok(id)
  }

/**
 * Enables or disables the SwitchioPay card terminal, mirroring
 * {@link saveCashRegisterAccount}. Only Android can drive the terminal (the
 * ECR protocol is intent-based), but the account itself is plain synced data
 * — the runtime gate belongs in the UI, not here.
 */
export const saveCardSwitchioAccount =
  ({
    enabled,
    currency,
  }: {
    readonly enabled: boolean
    readonly currency: FiatCurrency
  }): Task<AccountId | null, never, EvoluDep & EvoluOwnerDep> =>
  async (run) => {
    const { evolu, evoluOwner } = run.deps

    const [current] = await evolu.loadQuery(cardSwitchioAccountQuery)

    if (!enabled) {
      if (current === undefined) return ok(null)

      await runMutationWithCompletion((options) =>
        evolu.update(
          "account",
          { id: current.id, isDeleted: sqliteTrue },
          { ...options, owner: evoluOwner }
        )
      )

      return ok(current.id)
    }

    const id = createCardSwitchioAccountId(currency)

    await runMutationWithCompletion((options) => {
      const mutationOptions = { ...options, owner: evoluOwner }

      evolu.upsert("accountCardSwitchio", { id, currency }, mutationOptions)

      if (current !== undefined && current.id !== id) {
        evolu.update(
          "account",
          { id: current.id, isDeleted: sqliteTrue },
          mutationOptions
        )
      }

      return evolu.upsert(
        "account",
        {
          id,
          deviceId: null,
          name: NonEmptyString255("Card terminal"),
          kind: "cardSwitchio",
          isDeleted: sqliteFalse,
        },
        mutationOptions
      )
    })

    return ok(id)
  }

/**
 * Enables or disables the Qerko card terminal, mirroring
 * {@link saveCardSwitchioAccount}. Unlike SwitchioPay it needs no Android: the
 * account is plain synced data and the terminal is driven over HTTP, so any
 * device can take the payment once the plugin is paired and it has chosen a
 * terminal.
 */
export const saveQerkoTerminalAccount =
  ({
    enabled,
    currency,
  }: {
    readonly enabled: boolean
    readonly currency: FiatCurrency
  }): Task<AccountId | null, never, EvoluDep & EvoluOwnerDep> =>
  async (run) => {
    const { evolu, evoluOwner } = run.deps

    const [current] = await evolu.loadQuery(qerkoTerminalAccountQuery)

    if (!enabled) {
      if (current === undefined) return ok(null)

      await runMutationWithCompletion((options) =>
        evolu.update(
          "account",
          { id: current.id, isDeleted: sqliteTrue },
          { ...options, owner: evoluOwner }
        )
      )

      return ok(current.id)
    }

    const id = createQerkoTerminalAccountId(currency)

    await runMutationWithCompletion((options) => {
      const mutationOptions = { ...options, owner: evoluOwner }

      evolu.upsert("accountQerkoTerminal", { id, currency }, mutationOptions)

      if (current !== undefined && current.id !== id) {
        evolu.update(
          "account",
          { id: current.id, isDeleted: sqliteTrue },
          mutationOptions
        )
      }

      return evolu.upsert(
        "account",
        {
          id,
          deviceId: null,
          name: NonEmptyString255("Qerko terminal"),
          kind: "qerkoTerminal",
          isDeleted: sqliteFalse,
        },
        mutationOptions
      )
    })

    return ok(id)
  }

/**
 * Enables or disables Cashu payments (cashu.md §4). The account's id derives
 * from Linky's app owner, so every device writes the same row. Enabling seeds
 * Linky's default mint into the shared wallet when it has none yet, as Linky's
 * onboarding does. Returns `null` when disabling an account that never existed.
 */
export const saveCashuAccount =
  ({
    enabled,
  }: {
    readonly enabled: boolean
  }): Task<
    AccountId | null,
    never,
    EvoluDep & EvoluOwnerDep & CashuShardStoreDep
  > =>
  async (run) => {
    const { evolu, evoluOwner, cashuShardStore } = run.deps
    const [current] = await evolu.loadQuery(cashuAccountQuery)
    if (!enabled && current === undefined) return ok(null)

    const id = createCashuAccountId(cashuShardStore.linkyAppOwner.id)

    await runMutationWithCompletion((options) => {
      const mutationOptions = { ...options, owner: evoluOwner }
      evolu.upsert("accountCashu", { id }, mutationOptions)
      if (current !== undefined && current.id !== id) {
        evolu.update(
          "account",
          { id: current.id, isDeleted: sqliteTrue },
          mutationOptions
        )
      }
      return evolu.upsert(
        "account",
        {
          id,
          deviceId: null,
          name: NonEmptyString255("Cashu"),
          kind: "cashu",
          isDeleted: enabled ? sqliteFalse : sqliteTrue,
        },
        mutationOptions
      )
    })

    // The shared wallet waits for Linky's owners to sync; the account does not.
    if (enabled)
      seedCashuDefaultMint(cashuShardStore).catch(() => {
        // Best effort: without the row, payments use Linky's default anyway.
      })

    return ok(id)
  }

/**
 * What the Cashu wallet's payment QR carries (settings/0003): both legs,
 * the mint's invoice alone or the NUT-18 request alone. Written on the
 * account the wallet has; `null` while it has none.
 */
export const setCashuPaymentRequestLegs =
  (
    legs: CashuPaymentRequestLegs
  ): Task<AccountId | null, never, EvoluDep & EvoluOwnerDep> =>
  async (run) => {
    const { evolu, evoluOwner } = run.deps
    const [current] = await evolu.loadQuery(cashuAccountQuery)
    if (current === undefined) return ok(null)

    await runMutationWithCompletion((options) =>
      evolu.update(
        "accountCashu",
        { id: current.id, paymentRequestLegs: legs },
        { ...options, owner: evoluOwner }
      )
    )
    return ok(current.id)
  }

/**
 * Saves the merchant's Lightning address (lightning-address/0006). The id
 * derives from the address, so a new address writes a new account and the
 * one it replaces is retired in the same batch; its past transactions keep
 * pointing at the address their money went to. Returns `null` when no
 * address was ever saved and none is given. The caller probes the address
 * first (`probeLightningAddress`): this only writes.
 */
export const saveLightningAddressAccount =
  ({
    enabled,
    address,
  }: {
    readonly enabled: boolean
    /** Lowercased, as `parseLightningAddress` gives it. */
    readonly address?: NonEmptyString255
  }): Task<AccountId | null, never, EvoluDep & EvoluOwnerDep> =>
  async (run) => {
    const { evolu, evoluOwner } = run.deps

    const [current] = await evolu.loadQuery(lightningAddressAccountQuery)
    const nextAddress = address ?? current?.address
    if (nextAddress === undefined) return ok(null)

    const id = createLightningAddressAccountId(nextAddress)

    await runMutationWithCompletion((options) => {
      const mutationOptions = { ...options, owner: evoluOwner }

      evolu.upsert(
        "accountLightningAddress",
        { id, address: nextAddress },
        mutationOptions
      )

      if (current !== undefined && current.id !== id) {
        evolu.update(
          "account",
          { id: current.id, isDeleted: sqliteTrue },
          mutationOptions
        )
      }

      return evolu.upsert(
        "account",
        {
          id,
          deviceId: null,
          name: nextAddress,
          kind: "lightningAddress",
          isDeleted: enabled ? sqliteFalse : sqliteTrue,
        },
        mutationOptions
      )
    })

    return ok(id)
  }
