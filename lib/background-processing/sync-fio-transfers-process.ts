import {
	createIdFromString,
	getOrThrow,
	type Id,
	sqliteFalse,
	sqliteTrue,
} from "@evolu/common";
import type { BackgroundProcess } from "@/lib/background-processing/background-process";
import { FioApiClient } from "@/lib/fio/fio-api-client";

const notificationId = createIdFromString("syncFioTransfers");

const incomeTransactionTypes = [
	"Bezhotovostní příjem",
	"Příjem převodem uvnitř banky",
] as const;

type FioIncomingTransaction = {
	Typ: (typeof incomeTransactionTypes)[number];
	VS: string;
	Měna: string;
	Objem: number;
};

const isFioIncomingTransaction = (transaction: {
	Typ: string;
	VS?: unknown;
	Měna?: unknown;
	Objem?: unknown;
}): transaction is FioIncomingTransaction => {
	if (
		transaction.Typ !== "Bezhotovostní příjem" &&
		transaction.Typ !== "Příjem převodem uvnitř banky"
	) {
		return false;
	}
	return (
		typeof transaction.VS === "string" &&
		typeof transaction.Měna === "string" &&
		typeof transaction.Objem === "number"
	);
};

const normalizeIban = (value: string) =>
	value.replace(/\s+/g, "").toUpperCase();

const toRecord = (value: unknown): Record<string, unknown> =>
	value !== null && typeof value === "object"
		? (value as Record<string, unknown>)
		: {};

const toStableString = (value: unknown): string => {
	if (Array.isArray(value)) {
		return `[${value.map((item) => toStableString(item)).join(",")}]`;
	}
	if (value !== null && typeof value === "object") {
		const entries = Object.entries(value as Record<string, unknown>).sort(
			([a], [b]) => a.localeCompare(b),
		);
		return `{${entries
			.map(([key, item]) => `${JSON.stringify(key)}:${toStableString(item)}`)
			.join(",")}}`;
	}
	return JSON.stringify(value);
};

const toOptionalText = (value: unknown, maxLength: number): string | null => {
	const normalized =
		typeof value === "number"
			? `${value}`
			: typeof value === "string"
				? value
				: null;
	if (normalized === null) return null;

	const trimmed = normalized.trim();
	if (trimmed.length === 0) return null;

	return trimmed.slice(0, maxLength);
};

const parseDateFromString = (value: string): number | null => {
	const trimmed = value.trim();
	if (trimmed.length === 0) return null;

	const parsed = Date.parse(trimmed);
	if (Number.isFinite(parsed)) return parsed;

	const czechDate =
		/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;
	const match = trimmed.match(czechDate);
	if (!match) return null;

	const day = Number(match[1]);
	const month = Number(match[2]);
	const year = Number(match[3]);
	const hour = Number(match[4] ?? "0");
	const minute = Number(match[5] ?? "0");
	const second = Number(match[6] ?? "0");

	const result = new Date(year, month - 1, day, hour, minute, second).getTime();
	return Number.isFinite(result) ? result : null;
};

const resolveOccurredAt = (transaction: Record<string, unknown>): number => {
	const preferredDateKeys = [
		"Datum",
		"Datum připsání",
		"Datum provedení",
		"Datum zaúčtování",
	];

	for (const key of preferredDateKeys) {
		const value = transaction[key];
		if (typeof value === "string") {
			const parsed = parseDateFromString(value);
			if (parsed !== null) return parsed;
		}
	}

	for (const [key, value] of Object.entries(transaction)) {
		if (typeof value === "string" && key.toLowerCase().includes("datum")) {
			const parsed = parseDateFromString(value);
			if (parsed !== null) return parsed;
		}
	}

	return Date.now();
};

const resolveBankReference = (
	transaction: Record<string, unknown>,
): string | null => {
	const candidates = [
		transaction.Komentář,
		transaction["Zpráva pro příjemce"],
		transaction["Message for recipient"],
	];

	for (const candidate of candidates) {
		const value = toOptionalText(candidate, 1000);
		if (value !== null) return value;
	}

	return null;
};

export const syncFioTransfersProcess: BackgroundProcess = {
	name: "syncFioTransfers",
	run: async (props) => {
		const notification = props.addNotification({
			title: "FIO transfers sync",
			type: "info",
			progress: null,
			canBeClosed: true,
			description: "Waiting for next sync...",
			isUnread: false,
			id: notificationId,
			timestamp: Date.now(),
		});

		let fioApiClient: FioApiClient | null = null;
		let fioClientConfigKey = "";
		let intervalMs = 30_000;
		let syncInProgress = false;
		let stopped = false;
		let timer: ReturnType<typeof setTimeout> | null = null;

		const syncOnce = async () => {
			if (syncInProgress) return;
			syncInProgress = true;

			try {
				notification.update({
					title: "FIO transfers sync",
					type: "info",
					progress: null,
					canBeClosed: true,
					description: "Syncing transfers from FIO...",
					isUnread: false,
					id: notificationId,
					timestamp: Date.now(),
				});

				const fioPluginId = createIdFromString("");
				const fioPluginRows = await props.evolu.loadQuery(
					props.evolu.createQuery((db) =>
						db
							.selectFrom("fioPlugin")
							.select([
								"fioPlugin.apiUrl as apiUrl",
								"fioPlugin.numberOfSecondsBetweenChecks as numberOfSecondsBetweenChecks",
								"fioPlugin.isActive as isActive",
							] as const)
							.where("fioPlugin.isDeleted", "is not", sqliteTrue)
							.where("fioPlugin.id", "=", fioPluginId),
					),
				);
				const fioPluginTokens = await props.evolu.loadQuery(
					props.evolu.createQuery((db) =>
						db
							.selectFrom("fioPluginToken")
							.select(["fioPluginToken.token as token"] as const)
							.where("fioPluginToken.isDeleted", "is not", sqliteTrue)
							.where("fioPluginToken.fioPluginId", "=", fioPluginId)
							.orderBy("fioPluginToken.id", "asc"),
					),
				);

				const fioData = fioPluginRows[0];
				const tokens = fioPluginTokens.flatMap((item) =>
					item.token === null ? [] : [`${item.token}`],
				);
				if (fioData?.isActive !== sqliteTrue) {
					notification.update({
						title: "FIO transfers sync",
						type: "info",
						progress: null,
						canBeClosed: true,
						description: "Plugin is inactive. Sync is paused.",
						isUnread: false,
						id: notificationId,
						timestamp: Date.now(),
					});
					return;
				}

				if (
					!fioData?.apiUrl ||
					fioData.numberOfSecondsBetweenChecks === null ||
					tokens.length === 0
				) {
					notification.update({
						title: "FIO transfers sync",
						type: "warning",
						progress: null,
						canBeClosed: true,
						description:
							"Missing FIO plugin configuration (API URL, interval, or tokens).",
						isUnread: false,
						id: notificationId,
						timestamp: Date.now(),
					});
					return;
				}

				intervalMs = Math.max(1, fioData.numberOfSecondsBetweenChecks) * 1000;

				const clientConfigKey = `${fioData.apiUrl}|${tokens.join("|")}`;
				if (fioApiClient === null || fioClientConfigKey !== clientConfigKey) {
					fioApiClient = new FioApiClient(tokens, fioData.apiUrl);
					fioClientConfigKey = clientConfigKey;
				}

				const ibanAccounts = await props.evolu.loadQuery(
					props.evolu.createQuery((db) =>
						db
							.selectFrom("account")
							.innerJoin("accountIban", "accountIban.id", "account.id")
							.select([
								"account.id as id",
								"accountIban.iban as iban",
								"accountIban.currency as currency",
							] as const)
							.where("account.isDeleted", "is not", sqliteTrue)
							.where("accountIban.isDeleted", "is not", sqliteTrue),
					),
				);

				const accountByIban = new Map<
					string,
					{
						id: Id;
						currency: string | null;
					}
				>();
				for (const row of ibanAccounts) {
					if (!row.iban) continue;
					accountByIban.set(normalizeIban(row.iban), {
						id: row.id,
						currency: row.currency,
					});
				}

				const response = await fioApiClient.getTransactions();
				const statementIban = normalizeIban(
					response.accountStatement.info.iban,
				);
				const account = accountByIban.get(statementIban);
				if (!account) {
					notification.update({
						title: "FIO transfers sync",
						type: "warning",
						progress: null,
						canBeClosed: true,
						description: `No IBAN account found for ${statementIban}.`,
						isUnread: false,
						id: notificationId,
						timestamp: Date.now(),
					});
					return;
				}

				let processedTransfers = 0;
				for (const transaction of response.accountStatement.transactionList
					.transaction) {
					if (!isFioIncomingTransaction(transaction)) {
						continue;
					}

					if (account.currency && transaction.Měna !== account.currency) {
						continue;
					}

					if (!Number.isInteger(transaction.Objem)) {
						continue;
					}

					const transactionRecord = toRecord(transaction);
					const transferId = createIdFromString(
						`fioTransfer:${account.id}:${toStableString(transactionRecord)}`,
					);

					getOrThrow(
						props.evolu.upsert("transaction", {
							id: transferId,
							accountId: account.id,
							_tag: "accountIban",
							amount: transaction.Objem,
							occurredAt: resolveOccurredAt(transactionRecord),
							note: toOptionalText(transaction.Typ, 1000),
							internalTransferGroupId: null,
						}),
					);

					getOrThrow(
						props.evolu.upsert("transactionIban", {
							id: transferId,
							variableSymbol: toOptionalText(transaction.VS, 100),
							constantSymbol: toOptionalText(transactionRecord.KS, 100),
							specificSymbol: toOptionalText(transactionRecord.SS, 100),
							bankReference: resolveBankReference(transactionRecord),
						}),
					);

					processedTransfers += 1;
				}

				notification.update({
					title: "FIO transfers sync",
					type: "success",
					progress: null,
					canBeClosed: true,
					description: `Synced ${processedTransfers} transfer(s). Next check in ${Math.round(intervalMs / 1000)}s.`,
					isUnread: false,
					id: notificationId,
					timestamp: Date.now(),
				});
			} catch (error) {
				notification.update({
					title: "FIO transfers sync",
					type: "error",
					progress: null,
					canBeClosed: true,
					description:
						error instanceof Error
							? `Sync failed: ${error.message}`
							: "Sync failed due to unknown error.",
					isUnread: false,
					id: notificationId,
					timestamp: Date.now(),
				});
			} finally {
				syncInProgress = false;
			}
		};

		const scheduleNextSync = () => {
			if (stopped) return;
			timer = globalThis.setTimeout(() => {
				void syncOnce().finally(() => {
					scheduleNextSync();
				});
			}, intervalMs);
		};

		void syncOnce().finally(() => {
			scheduleNextSync();
		});

		return () => {
			stopped = true;
			if (timer !== null) {
				globalThis.clearTimeout(timer);
			}
		};
	},
};
