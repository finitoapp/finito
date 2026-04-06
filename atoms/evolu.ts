import { createIdFromString, sqliteTrue } from "@evolu/common";
import { sha256 } from "@noble/hashes/sha2.js";
import { atom } from "jotai";
import { accountAtom } from "@/atoms/account";
import { createAppEvolu, createQuery } from "@/lib/evolu";
import { PaymentDefaultMethodType } from "@/lib/evolu/model/payment-default-method";
import { FiatCurrency, NonEmptyString255 } from "@/lib/shared/types";

export const evoluAtom = atom(async (get) => {
	const account = await get(accountAtom);
	const evolu = await createAppEvolu({
		mnemonic: account.mnemonic,
		transports: account.transports,
	});

	// Seed initial data
	(async () => {
		// Copy device identification to the shared evolu instance. Skip waiting
		void (async () => {
			const data = await evolu.loadQuery(
				createQuery((db) =>
					db
						.selectFrom("device")
						.selectAll()
						.where("isDeleted", "is not", sqliteTrue)
						.where("id", "=", account.device.id),
				),
			);
			if (data.length === 0) {
				evolu.upsert("device", account.device);
			}
		})();

		const appOwner = await evolu.appOwner;
		if (appOwner.mnemonic === null || appOwner.mnemonic === undefined)
			throw new Error(
				"App owner mnemonic is not set. Please create a new account.",
			);

		// Create default accounts and payment methods
		{
			const msgBuffer = new TextEncoder().encode(appOwner.mnemonic);
			const hashBuffer = sha256(msgBuffer);
			const hashArray = Array.from(new Uint8Array(hashBuffer));
			const sparkAccountId = createIdFromString(
				hashArray.map((b) => b.toString(16).padStart(2, "0")).join(""),
			);
			const cashRegisterAccountId = createIdFromString(
				`${sparkAccountId}:cashRegister`,
			);
			const sparkPaymentDefaultMethodId = createIdFromString(
				`${sparkAccountId}:paymentDefaultMethod:${PaymentDefaultMethodType.BtcLn}`,
			);
			const cashRegisterPaymentDefaultMethodId = createIdFromString(
				`${cashRegisterAccountId}:paymentDefaultMethod:${PaymentDefaultMethodType.Cash}`,
			);

			const sparkAccount = await evolu.loadQuery(
				createQuery((db) =>
					db
						.selectFrom("account")
						.selectAll()
						.where("isDeleted", "is not", sqliteTrue)
						.where("id", "=", sparkAccountId),
				),
			);

			if (sparkAccount.length === 0) {
				evolu.upsert("account", {
					id: sparkAccountId,
					name: NonEmptyString255("Default"),
					_tag: "accountSpark",
				});
				evolu.upsert("accountSpark", {
					id: sparkAccountId,
					mnemonic: NonEmptyString255(appOwner.mnemonic),
				});
			}

			const cashRegisterAccount = await evolu.loadQuery(
				createQuery((db) =>
					db
						.selectFrom("account")
						.selectAll()
						.where("isDeleted", "is not", sqliteTrue)
						.where("id", "=", cashRegisterAccountId),
				),
			);

			if (cashRegisterAccount.length === 0) {
				evolu.upsert("account", {
					id: cashRegisterAccountId,
					name: NonEmptyString255("Cash Register"),
					_tag: "accountCashRegister",
				});
				evolu.upsert("accountCashRegister", {
					id: cashRegisterAccountId,
					currency: FiatCurrency.CZK,
				});
			}

			const sparkPaymentDefaultMethod = await evolu.loadQuery(
				createQuery((db) =>
					db
						.selectFrom("paymentDefaultMethod")
						.selectAll()
						.where("isDeleted", "is not", sqliteTrue)
						.where("id", "=", sparkPaymentDefaultMethodId),
				),
			);

			if (sparkPaymentDefaultMethod.length === 0) {
				evolu.upsert("paymentDefaultMethod", {
					id: sparkPaymentDefaultMethodId,
					type: PaymentDefaultMethodType.BtcLn,
					accountId: sparkAccountId,
					pausedAt: null,
				});
			}

			const cashRegisterPaymentDefaultMethod = await evolu.loadQuery(
				createQuery((db) =>
					db
						.selectFrom("paymentDefaultMethod")
						.selectAll()
						.where("isDeleted", "is not", sqliteTrue)
						.where("id", "=", cashRegisterPaymentDefaultMethodId),
				),
			);

			if (cashRegisterPaymentDefaultMethod.length === 0) {
				evolu.upsert("paymentDefaultMethod", {
					id: cashRegisterPaymentDefaultMethodId,
					type: PaymentDefaultMethodType.Cash,
					accountId: cashRegisterAccountId,
					pausedAt: null,
				});
			}
		}
	})();

	return evolu;
});
