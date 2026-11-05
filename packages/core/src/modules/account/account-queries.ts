import { type KyselyNotNull, sqliteTrue } from "@evolu/common"
import { sql } from "kysely"

import { createQuery } from "../../evolu/schema.ts"
import type { AccountId } from "./account-types.ts"

export const accountByIdQuery = (idValue: AccountId) =>
  createQuery((db) =>
    db
      .selectFrom("account")
      .selectAll()
      .where("id", "=", idValue)
      .where("name", "is not", null)
      .where("kind", "is not", null)
      .$narrowType<{
        name: KyselyNotNull
        kind: KyselyNotNull
      }>()
  )

export const cashRegisterAccountByIdQuery = (idValue: AccountId) =>
  createQuery((db) =>
    db
      .selectFrom("account")
      .innerJoin("accountCashRegister", "accountCashRegister.id", "account.id")
      .select([
        "account.id",
        "account.name",
        "account.kind",
        "accountCashRegister.currency",
      ])
      .where("account.id", "=", idValue)
      .where("account.kind", "=", "cashRegister")
      .where("account.isDeleted", "is not", sqliteTrue)
      .where("accountCashRegister.isDeleted", "is not", sqliteTrue)
      .where("accountCashRegister.currency", "is not", null)
      .$narrowType<{
        name: KyselyNotNull
        kind: KyselyNotNull
        currency: KyselyNotNull
      }>()
  )

export const cardSwitchioAccountByIdQuery = (idValue: AccountId) =>
  createQuery((db) =>
    db
      .selectFrom("account")
      .innerJoin("accountCardSwitchio", "accountCardSwitchio.id", "account.id")
      .select([
        "account.id",
        "account.name",
        "account.kind",
        "accountCardSwitchio.currency",
      ])
      .where("account.id", "=", idValue)
      .where("account.kind", "=", "cardSwitchio")
      .where("account.isDeleted", "is not", sqliteTrue)
      .where("accountCardSwitchio.isDeleted", "is not", sqliteTrue)
      .where("accountCardSwitchio.currency", "is not", null)
      .$narrowType<{
        name: KyselyNotNull
        kind: KyselyNotNull
        currency: KyselyNotNull
      }>()
  )

export const qerkoTerminalAccountByIdQuery = (idValue: AccountId) =>
  createQuery((db) =>
    db
      .selectFrom("account")
      .innerJoin(
        "accountQerkoTerminal",
        "accountQerkoTerminal.id",
        "account.id"
      )
      .select([
        "account.id",
        "account.name",
        "account.kind",
        "accountQerkoTerminal.currency",
      ])
      .where("account.id", "=", idValue)
      .where("account.kind", "=", "qerkoTerminal")
      .where("account.isDeleted", "is not", sqliteTrue)
      .where("accountQerkoTerminal.isDeleted", "is not", sqliteTrue)
      .where("accountQerkoTerminal.currency", "is not", null)
      .$narrowType<{
        name: KyselyNotNull
        kind: KyselyNotNull
        currency: KyselyNotNull
      }>()
  )

export const ibanAccountByIdQuery = (idValue: AccountId) =>
  createQuery((db) =>
    db
      .selectFrom("account")
      .innerJoin("accountIban", "accountIban.id", "account.id")
      .select([
        "account.id",
        "account.name",
        "account.kind",
        "accountIban.iban",
        "accountIban.currency",
        "accountIban.defaultQrFormat",
      ])
      .where("account.id", "=", idValue)
      .where("account.kind", "=", "iban")
      .where("account.isDeleted", "is not", sqliteTrue)
      .where("accountIban.isDeleted", "is not", sqliteTrue)
      .where("accountIban.iban", "is not", null)
      .where("accountIban.currency", "is not", null)
      .$narrowType<{
        name: KyselyNotNull
        kind: KyselyNotNull
        iban: KyselyNotNull
        currency: KyselyNotNull
      }>()
  )

/**
 * When an account was last saved: the latest change of its `detail` row,
 * Evolu's `updatedAt`, or `createdAt` for a row changed once. Only saving the
 * account writes that row; retiring it changes `account` alone. Evolu's
 * `createdAt` is the time of a row's earliest change, which saving it again
 * leaves as it was.
 */
const lastSavedAt = (
  detail:
    | "accountIban"
    | "accountSpark"
    | "accountCashRegister"
    | "accountCardSwitchio"
    | "accountQerkoTerminal"
    | "accountCashu"
    | "accountLightningAddress"
) =>
  sql<string>`coalesce(${sql.ref(`${detail}.updatedAt`)}, ${sql.ref(`${detail}.createdAt`)})`

/**
 * The account of this kind the app configures from settings — the enabled
 * one, else the most recently saved disabled one, so a disabled account still
 * shows the configuration it would come back with. Saving it retires any
 * other account of the kind, so more than one enabled row only appears after
 * two devices saved different values offline; the latest save wins, the same
 * on every device.
 *
 * "Latest save" is `lastSavedAt`, not the account's own `updatedAt`:
 * retiring the replaced account is an update in the very batch that saves its
 * successor, so the two would share that time, and when the successor is saved
 * disabled nothing would tell them apart.
 */
export const fiatBankAccountQuery = createQuery((db) =>
  db
    .selectFrom("account")
    .innerJoin("accountIban", "accountIban.id", "account.id")
    .select([
      "account.id",
      "account.name",
      "account.kind",
      "account.isDeleted",
      "accountIban.iban",
      "accountIban.currency",
      "accountIban.defaultQrFormat",
    ])
    .where("account.kind", "=", "iban")
    .where("accountIban.isDeleted", "is not", sqliteTrue)
    .where("account.name", "is not", null)
    .where("account.kind", "is not", null)
    .where("accountIban.iban", "is not", null)
    .where("accountIban.currency", "is not", null)
    .orderBy("account.isDeleted")
    .orderBy(lastSavedAt("accountIban"), "desc")
    .orderBy("account.id")
    .limit(1)
    .$narrowType<{
      name: KyselyNotNull
      kind: KyselyNotNull
      iban: KyselyNotNull
      currency: KyselyNotNull
    }>()
)

/** Picked the same way as `fiatBankAccountQuery`. */
export const sparkAccountQuery = createQuery((db) =>
  db
    .selectFrom("account")
    .innerJoin("accountSpark", "accountSpark.id", "account.id")
    .select([
      "account.id",
      "account.name",
      "account.kind",
      "account.isDeleted",
      "accountSpark.secret",
    ])
    .where("account.kind", "=", "spark")
    .where("accountSpark.isDeleted", "is not", sqliteTrue)
    .where("account.name", "is not", null)
    .where("account.kind", "is not", null)
    .where("accountSpark.secret", "is not", null)
    .orderBy("account.isDeleted")
    .orderBy(lastSavedAt("accountSpark"), "desc")
    .orderBy("account.id")
    .limit(1)
    .$narrowType<{
      name: KyselyNotNull
      kind: KyselyNotNull
      secret: KyselyNotNull
    }>()
)

/** Picked the same way as `fiatBankAccountQuery`. */
export const cashRegisterAccountQuery = createQuery((db) =>
  db
    .selectFrom("account")
    .innerJoin("accountCashRegister", "accountCashRegister.id", "account.id")
    .select([
      "account.id",
      "account.name",
      "account.kind",
      "account.isDeleted",
      "accountCashRegister.currency",
    ])
    .where("account.kind", "=", "cashRegister")
    .where("accountCashRegister.isDeleted", "is not", sqliteTrue)
    .where("account.name", "is not", null)
    .where("account.kind", "is not", null)
    .where("accountCashRegister.currency", "is not", null)
    .orderBy("account.isDeleted")
    .orderBy(lastSavedAt("accountCashRegister"), "desc")
    .orderBy("account.id")
    .limit(1)
    .$narrowType<{
      name: KyselyNotNull
      kind: KyselyNotNull
      currency: KyselyNotNull
    }>()
)

export const cardSwitchioAccountQuery = createQuery((db) =>
  db
    .selectFrom("account")
    .innerJoin("accountCardSwitchio", "accountCardSwitchio.id", "account.id")
    .select([
      "account.id",
      "account.name",
      "account.kind",
      "account.isDeleted",
      "accountCardSwitchio.currency",
    ])
    .where("account.kind", "=", "cardSwitchio")
    .where("accountCardSwitchio.isDeleted", "is not", sqliteTrue)
    .where("account.name", "is not", null)
    .where("account.kind", "is not", null)
    .where("accountCardSwitchio.currency", "is not", null)
    .orderBy("account.isDeleted")
    .orderBy(lastSavedAt("accountCardSwitchio"), "desc")
    .orderBy("account.id")
    .limit(1)
    .$narrowType<{
      name: KyselyNotNull
      kind: KyselyNotNull
      currency: KyselyNotNull
    }>()
)

export const qerkoPaymentAccountByIdQuery = (idValue: AccountId) =>
  createQuery((db) =>
    db
      .selectFrom("account")
      .innerJoin("accountQerkoPayment", "accountQerkoPayment.id", "account.id")
      .select([
        "account.id",
        "account.name",
        "account.kind",
        "accountQerkoPayment.currency",
        "accountQerkoPayment.connectionDeviceId",
      ])
      .where("account.id", "=", idValue)
      .where("account.kind", "=", "qerkoPayment")
      .where("account.isDeleted", "is not", sqliteTrue)
      .where("accountQerkoPayment.isDeleted", "is not", sqliteTrue)
      .where("accountQerkoPayment.currency", "is not", null)
      .$narrowType<{
        name: KyselyNotNull
        kind: KyselyNotNull
        currency: KyselyNotNull
      }>()
  )

/** The Qerko payment account, enabled or not: there is at most one. */
export const qerkoPaymentAccountQuery = createQuery((db) =>
  db
    .selectFrom("account")
    .innerJoin("accountQerkoPayment", "accountQerkoPayment.id", "account.id")
    .select([
      "account.id",
      "account.name",
      "account.kind",
      "account.isDeleted",
      "accountQerkoPayment.currency",
      "accountQerkoPayment.connectionDeviceId",
    ])
    .where("account.kind", "=", "qerkoPayment")
    .where("accountQerkoPayment.isDeleted", "is not", sqliteTrue)
    .where("account.name", "is not", null)
    .where("account.kind", "is not", null)
    .where("accountQerkoPayment.currency", "is not", null)
    .orderBy("account.isDeleted")
    .orderBy("account.createdAt", "desc")
    .orderBy("account.id")
    .limit(1)
    .$narrowType<{
      name: KyselyNotNull
      kind: KyselyNotNull
      currency: KyselyNotNull
    }>()
)

export const qerkoTerminalAccountQuery = createQuery((db) =>
  db
    .selectFrom("account")
    .innerJoin("accountQerkoTerminal", "accountQerkoTerminal.id", "account.id")
    .select([
      "account.id",
      "account.name",
      "account.kind",
      "account.isDeleted",
      "accountQerkoTerminal.currency",
    ])
    .where("account.kind", "=", "qerkoTerminal")
    .where("accountQerkoTerminal.isDeleted", "is not", sqliteTrue)
    .where("account.name", "is not", null)
    .where("account.kind", "is not", null)
    .where("accountQerkoTerminal.currency", "is not", null)
    .orderBy("account.isDeleted")
    .orderBy(lastSavedAt("accountQerkoTerminal"), "desc")
    .orderBy("account.id")
    .limit(1)
    .$narrowType<{
      name: KyselyNotNull
      kind: KyselyNotNull
      currency: KyselyNotNull
    }>()
)

/** The Cashu account, enabled or not: there is at most one per shared wallet. */
export const cashuAccountQuery = createQuery((db) =>
  db
    .selectFrom("account")
    .innerJoin("accountCashu", "accountCashu.id", "account.id")
    .select([
      "account.id",
      "account.name",
      "account.kind",
      "account.isDeleted",
      "accountCashu.paymentRequestLegs",
    ])
    .where("account.kind", "=", "cashu")
    .where("accountCashu.isDeleted", "is not", sqliteTrue)
    .where("account.name", "is not", null)
    .orderBy("account.isDeleted")
    .orderBy(lastSavedAt("accountCashu"), "desc")
    .orderBy("account.id")
    .limit(1)
    .$narrowType<{ name: KyselyNotNull; kind: KyselyNotNull }>()
)

export const activeCashuAccountByIdQuery = (idValue: AccountId) =>
  createQuery((db) =>
    db
      .selectFrom("account")
      .innerJoin("accountCashu", "accountCashu.id", "account.id")
      .select(["account.id"])
      .where("account.id", "=", idValue)
      .where("account.kind", "=", "cashu")
      .where("account.isDeleted", "is not", sqliteTrue)
      .where("accountCashu.isDeleted", "is not", sqliteTrue)
  )

/** Picked the same way as `fiatBankAccountQuery`. */
export const lightningAddressAccountQuery = createQuery((db) =>
  db
    .selectFrom("account")
    .innerJoin(
      "accountLightningAddress",
      "accountLightningAddress.id",
      "account.id"
    )
    .select([
      "account.id",
      "account.name",
      "account.kind",
      "account.isDeleted",
      "accountLightningAddress.address",
    ])
    .where("account.kind", "=", "lightningAddress")
    .where("accountLightningAddress.isDeleted", "is not", sqliteTrue)
    .where("account.name", "is not", null)
    .where("account.kind", "is not", null)
    .where("accountLightningAddress.address", "is not", null)
    .orderBy("account.isDeleted")
    .orderBy(lastSavedAt("accountLightningAddress"), "desc")
    .orderBy("account.id")
    .limit(1)
    .$narrowType<{
      name: KyselyNotNull
      kind: KyselyNotNull
      address: KyselyNotNull
    }>()
)

/**
 * A Lightning address account by id, deleted or not: a payment prepared
 * before the address changed still settles to the account it was asked of.
 */
export const lightningAddressAccountByIdQuery = (idValue: AccountId) =>
  createQuery((db) =>
    db
      .selectFrom("account")
      .innerJoin(
        "accountLightningAddress",
        "accountLightningAddress.id",
        "account.id"
      )
      .select([
        "account.id",
        "account.isDeleted",
        "accountLightningAddress.address",
      ])
      .where("account.id", "=", idValue)
      .where("account.kind", "=", "lightningAddress")
      .where("accountLightningAddress.isDeleted", "is not", sqliteTrue)
      .where("accountLightningAddress.address", "is not", null)
      .$narrowType<{ address: KyselyNotNull }>()
  )

/**
 * Every non-deleted account with the method-specific columns the payment
 * waiting screen needs to offer a Spark, IBAN, cash-register, card or
 * Lightning address tab.
 *
 * Newest first, so the screen's first match per kind is the same account
 * `fiatBankAccountQuery` and its siblings pick.
 */
export const enabledPaymentMethodAccountsQuery = createQuery((db) =>
  db
    .selectFrom("account")
    .leftJoin("accountSpark", (join) =>
      join
        .onRef("accountSpark.id", "=", "account.id")
        .on("accountSpark.isDeleted", "is not", sqliteTrue)
    )
    .leftJoin("accountIban", (join) =>
      join
        .onRef("accountIban.id", "=", "account.id")
        .on("accountIban.isDeleted", "is not", sqliteTrue)
    )
    .leftJoin("accountCashRegister", (join) =>
      join
        .onRef("accountCashRegister.id", "=", "account.id")
        .on("accountCashRegister.isDeleted", "is not", sqliteTrue)
    )
    .leftJoin("accountCardSwitchio", (join) =>
      join
        .onRef("accountCardSwitchio.id", "=", "account.id")
        .on("accountCardSwitchio.isDeleted", "is not", sqliteTrue)
    )
    .leftJoin("accountQerkoTerminal", (join) =>
      join
        .onRef("accountQerkoTerminal.id", "=", "account.id")
        .on("accountQerkoTerminal.isDeleted", "is not", sqliteTrue)
    )
    .leftJoin("accountQerkoPayment", (join) =>
      join
        .onRef("accountQerkoPayment.id", "=", "account.id")
        .on("accountQerkoPayment.isDeleted", "is not", sqliteTrue)
    )
    .leftJoin("accountLightningAddress", (join) =>
      join
        .onRef("accountLightningAddress.id", "=", "account.id")
        .on("accountLightningAddress.isDeleted", "is not", sqliteTrue)
    )
    .select([
      "account.id",
      "account.kind",
      "accountSpark.secret as sparkSecret",
      "account.name",
      "accountIban.iban",
      "accountIban.currency as ibanCurrency",
      "accountIban.defaultQrFormat as ibanDefaultQrFormat",
      "accountCashRegister.currency as cashRegisterCurrency",
      "accountCardSwitchio.currency as cardCurrency",
      "accountQerkoTerminal.currency as qerkoTerminalCurrency",
      "accountQerkoPayment.currency as qerkoPaymentCurrency",
      "accountQerkoPayment.connectionDeviceId as qerkoPaymentConnectionDeviceId",
      "accountLightningAddress.address as lightningAddress",
    ])
    .where("account.isDeleted", "is not", sqliteTrue)
    .where("account.id", "is not", null)
    .where("account.kind", "is not", null)
    .orderBy("account.createdAt", "desc")
    .orderBy("account.id")
    .$narrowType<{
      id: KyselyNotNull
      kind: KyselyNotNull
    }>()
)
