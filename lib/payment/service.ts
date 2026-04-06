import { SparkWallet } from "@buildonspark/spark-sdk";
import {
	createIdFromString,
	type Id,
	type KyselyNotNull,
	sqliteTrue,
} from "@evolu/common";
import NDK, {
	NDKEvent,
	NDKPrivateKeySigner,
	type NDKSigner,
	type NDKUser,
} from "@nostr-dev-kit/ndk";
import { bech32 } from "@scure/base";
import { createQuery, type EvoluSchemaType } from "@/lib/evolu";
import { PaymentDefaultMethodType } from "@/lib/evolu/model/payment-default-method";
import { PaymentStatus } from "@/lib/evolu/model/payment-status";
import type { PaymentWatchingStopReason } from "@/lib/evolu/model/payment-watching-state";
import { createPaymentDefaultMethodsQuery } from "@/lib/evolu/queries/payment-default-method";
import { createItem } from "@/lib/item/service";
import { getBtcWalletAdapter } from "@/lib/payment/btc-wallet/registry";
import type { EvoluDep, NdkDep } from "@/lib/shared/dependencies";
import {
	type Email,
	Integer,
	NonEmptyString,
	type NonNegativeInteger,
	VariableSymbol,
} from "@/lib/shared/types";
import { lazy } from "@/lib/shared/utils/lazy";
import {
	extractExpirationFromLightningInvoice,
	extractPaymentHashFromLnInvoice,
} from "@/lib/shared/utils/ln";

export const resolvePaymentStatus = (params: {
	payment: Pick<EvoluSchemaType["payment"], "totalAmount"> & {
		reconciliationClaim: {
			amount: Integer | null;
		};
	};
}) => {
	const paymentStatus: PaymentStatus =
		params.payment && params.payment.reconciliationClaim.amount
			? params.payment.reconciliationClaim.amount > params.payment.totalAmount
				? PaymentStatus.Overpaid
				: params.payment.reconciliationClaim.amount < params.payment.totalAmount
					? PaymentStatus.Underpaid
					: PaymentStatus.Paid
			: PaymentStatus.Unpaid;

	return paymentStatus;
};

export const createLud16Payment = async (params: {
	lud16: Email;
	amountInSats: Integer;
}) => {
	const [username, domain] = params.lud16.split("@");
	const httpUrl = `https://${domain}/.well-known/lnurlp/${username}`;
	const lnurlResult = await fetch(httpUrl).then((result) => result.json());

	const amountInMilliSats = (params.amountInSats * 1000).toFixed(0);

	const createInvoiceResult = await fetch(
		`${lnurlResult.callback}?amount=${amountInMilliSats}`,
	).then((result) => result.json());

	return {
		lnInvoice: createInvoiceResult.pr,
	} as const;
};

export const createZapPayment =
	(deps: NdkDep) =>
	async (params: {
		lud16: Email;
		amountInSats: Integer;
		paymentNdk: NDK & {
			signer: NDKSigner;
			activeUser: NDKUser;
		};
	}) => {
		const [username, domain] = params.lud16.split("@");
		const httpUrl = `https://${domain}/.well-known/lnurlp/${username}`;
		const lnurlResult = await fetch(httpUrl).then((result) => result.json());

		const lnurl = bech32.encode(
			"lnurl",
			bech32.toWords(Buffer.from(httpUrl, "utf8")),
			108,
		);
		console.log("lnurl", lnurl);

		const amountInMilliSats = (params.amountInSats * 1000).toFixed(0);

		const zapRequestEvent = new NDKEvent(params.paymentNdk, {
			kind: 9734,
			created_at: Math.floor(Date.now() / 1000),
			tags: [
				["relays", ...deps.ndk.explicitRelayUrls], // List of relays for the zap receipt
				["amount", amountInMilliSats], // Amount in millisatoshis
				["lnurl", lnurl], // Recipient’s LNURL
				["p", params.paymentNdk.activeUser.pubkey], // Recipient’s public key
			],
			content: "Zap!",
		});

		await zapRequestEvent.sign();
		console.log("zapRequestEvent", await zapRequestEvent.toNostrEvent());

		const zapResult = await fetch(
			`${lnurlResult.callback}?amount=${amountInMilliSats}&nostr=${encodeURI(JSON.stringify(await zapRequestEvent.toNostrEvent()))}`,
		).then((result) => result.json());
		console.log("zapResult", zapResult);

		return {
			lnInvoice: zapResult.pr,
			walletPubkey: lnurlResult.nostrPubkey,
		} as const;
	};

export const createOutgoingPayment =
	(deps: EvoluDep) =>
	(params: {
		payment: Omit<EvoluSchemaType["payment"], "direction" | "tipAmount"> & {
			counterparty?: EvoluSchemaType["contact"];
		};
	}) => {
		const { counterparty, ...payment } = params.payment;

		deps.evolu.upsert("payment", {
			...payment,
			direction: "outgoing",
		});

		if (counterparty) {
			deps.evolu.upsert("paymentCounterparty", {
				...counterparty,
				sourceContactId: counterparty.id,
				id: payment.id,
			});
		}
	};

type CreatePaymentAmountOrItems =
	| {
			items: (Omit<
				EvoluSchemaType["paymentItemLine"],
				"id" | "paymentId" | "catalogItemId" | "itemId"
			> & {
				item: Omit<EvoluSchemaType["item"], "id">;
			})[];
			totalAmount?: undefined;
	  }
	| {
			items?: undefined;
			totalAmount: NonNegativeInteger;
	  };

type CreatePaymentParams = {
	payment: Omit<
		EvoluSchemaType["payment"],
		"direction" | "totalAmount" | "tipAmount"
	>;
	webData?: Omit<
		EvoluSchemaType["paymentWebData"],
		"id" | "privateKey" | "webPaymentEventId"
	>;
	paymentLnZap?: Omit<
		EvoluSchemaType["paymentLnZap"],
		| "id"
		| "expirationIn"
		| "paymentHash"
		| "lnInvoice"
		| "privateKey"
		| "walletPubkey"
	>;
	paymentLnSpark?: Omit<
		EvoluSchemaType["paymentLnSpark"],
		"id" | "expirationIn" | "paymentHash" | "lnInvoice" | "sparkInvoiceId"
	>;
	paymentLnNwc?: Omit<
		EvoluSchemaType["paymentLnNwc"],
		"id" | "expirationIn" | "paymentHash" | "lnInvoice"
	>;
	paymentBankTransferCZ?: Omit<EvoluSchemaType["paymentBankTransferCZ"], "id">;
	paymentCash?: Omit<EvoluSchemaType["paymentCash"], "id">;
	tipAmount: NonNegativeInteger | null;
} & CreatePaymentAmountOrItems;

type CreatePaymentWithDefaultMethodsParams = {
	payment: CreatePaymentParams["payment"];
	webData?: CreatePaymentParams["webData"];
	tipAmount: CreatePaymentParams["tipAmount"];
	amountInBtc?: NonNegativeInteger;
} & CreatePaymentAmountOrItems;

export const createPayment =
	(deps: EvoluDep & NdkDep) => async (params: CreatePaymentParams) => {
		const id = params.payment.id;

		let webPaymentEventId: NonEmptyString | null = null;

		const getPaymentNdk = lazy(async () => {
			const paymentSigner = NDKPrivateKeySigner.generate();
			const paymentNdk = new NDK({
				explicitRelayUrls: deps.ndk.explicitRelayUrls,
				signer: paymentSigner,
			}) as NDK & {
				signer: NDKSigner;
				activeUser: NDKUser;
			};

			await paymentNdk.connect();

			return { paymentNdk, paymentSigner };
		});

		if (params.webData) {
			const { paymentNdk } = await getPaymentNdk();
			const event = new NDKEvent(deps.ndk, {
				kind: 4,
				created_at: Math.floor(Date.now() / 1000),
				tags: [
					["p", paymentNdk.activeUser.pubkey],
					["finito_type", "static_payment"],
					["finito_version", "1.1"],
				],
				content: await deps.ndk.signer.encrypt(
					paymentNdk.activeUser,
					JSON.stringify({}),
					"nip04",
				),
			});

			const result = await event.publish();
			console.log("result", result, await event.toNostrEvent());
			webPaymentEventId = NonEmptyString(event.id);
		}

		const paymentLnSpark = params.paymentLnSpark;
		let sparkPaymentResult: Awaited<
			ReturnType<ReturnType<typeof createSparkPayment>>
		> | null = null;
		if (paymentLnSpark) {
			sparkPaymentResult = await createSparkPayment(deps)({
				amountInSats: paymentLnSpark.amount,
				accountId: paymentLnSpark.accountId,
			});
		}

		const paymentLnNwc = params.paymentLnNwc;
		let nwcPaymentResult: Awaited<
			ReturnType<ReturnType<typeof createNwcPayment>>
		> | null = null;
		if (paymentLnNwc) {
			nwcPaymentResult = await createNwcPayment(deps)({
				amountInSats: paymentLnNwc.amount,
				accountId: paymentLnNwc.accountId,
			});
		}

		const paymentLnZap = params.paymentLnZap;
		if (paymentLnZap) {
			const { paymentNdk, paymentSigner } = await getPaymentNdk();

			const accountRows = await deps.evolu.loadQuery(
				createQuery((db) =>
					db
						.selectFrom("accountLud16")
						.select(["accountLud16.lud16 as lud16"] as const)
						.where("accountLud16.id", "=", paymentLnZap.accountId)
						.where("accountLud16.isDeleted", "is not", sqliteTrue)
						.where("accountLud16.lud16", "is not", null)
						.$narrowType<{
							lud16: KyselyNotNull;
						}>(),
				),
			);

			const account = accountRows[0];
			if (account !== undefined) {
				const zapPaymentResult = await createZapPayment(deps)({
					amountInSats: paymentLnZap.amount,
					lud16: account.lud16,
					paymentNdk,
				});

				deps.evolu.upsert("paymentLnZap", {
					...paymentLnZap,
					id,
					walletPubkey: zapPaymentResult.walletPubkey,
					lnInvoice: zapPaymentResult.lnInvoice,
					paymentHash: extractPaymentHashFromLnInvoice(
						zapPaymentResult.lnInvoice,
					),
					expirationIn: extractExpirationFromLightningInvoice(
						zapPaymentResult.lnInvoice,
					),
					privateKey: NonEmptyString(paymentSigner.privateKey),
				});
			} else {
				console.warn("Account not found");
			}
		}

		deps.evolu.upsert("payment", {
			...params.payment,
			id,
			direction: "incoming",
			// billAllowTip: params.paymentData.bill.allowTip ? sqliteTrue : sqliteFalse,
			tipAmount: params.tipAmount,
			totalAmount: Integer(
				(params.tipAmount ?? 0) +
					(params.totalAmount ??
						params.items.reduce((acc, value) => {
							return acc + value.totalAmount;
						}, 0)),
			),
		});

		if (params.webData && webPaymentEventId) {
			const paymentSigner = NDKPrivateKeySigner.generate();

			deps.evolu.upsert("paymentWebData", {
				...params.webData,
				privateKey: NonEmptyString(paymentSigner.privateKey),
				webPaymentEventId,
				id,
			});
		}

		if (params.items) {
			for (const [index, { item, ...line }] of params.items.entries()) {
				const itemId = createIdFromString(`${id}:billItem:${index}`);

				const createdItem = await createItem(deps)({
					item,
				});

				deps.evolu.upsert("paymentItemLine", {
					...line,
					id: itemId,
					paymentId: id,
					catalogItemId: createdItem.catalogItemId,
					itemId: createdItem.id,
				});
			}
		}

		// for (const [index, billItem] of params.paymentData.bill.items.entries()) {
		// 	const itemId = createIdFromString(`${id}:billItem:${index}`);
		// 	deps.evolu.upsert("paymentItemLine", {
		// 		id: itemId,
		// 		paymentId: id,
		// 		price: billItem.price,
		// 		quantity: billItem.quantity,
		// 		optionalityChecked: billItem.optionality?.checked ?? null,
		// 	});
		// 	deps.evolu.upsert("paymentItem", {
		// 		id: itemId,
		// 		paymentId: id,
		// 		price: billItem.price,
		// 		label: billItem.label,
		// 	});
		// }

		if (params.paymentLnSpark && sparkPaymentResult) {
			deps.evolu.upsert("paymentLnSpark", {
				...params.paymentLnSpark,
				lnInvoice: sparkPaymentResult.lnInvoice,
				sparkInvoiceId: sparkPaymentResult.sparkInvoiceId,
				paymentHash: extractPaymentHashFromLnInvoice(
					sparkPaymentResult.lnInvoice,
				),
				expirationIn: extractExpirationFromLightningInvoice(
					sparkPaymentResult.lnInvoice,
				),
				id,
			});
		}

		if (params.paymentLnNwc && nwcPaymentResult) {
			deps.evolu.upsert("paymentLnNwc", {
				...params.paymentLnNwc,
				lnInvoice: nwcPaymentResult.lnInvoice,
				paymentHash: extractPaymentHashFromLnInvoice(
					nwcPaymentResult.lnInvoice,
				),
				expirationIn: extractExpirationFromLightningInvoice(
					nwcPaymentResult.lnInvoice,
				),
				id,
			});
		}

		if (params.paymentBankTransferCZ) {
			deps.evolu.upsert("paymentBankTransferCZ", {
				...params.paymentBankTransferCZ,
				id,
			});
		}

		if (params.paymentCash) {
			deps.evolu.upsert("paymentCash", {
				...params.paymentCash,
				id,
			});
		}

		if (params.paymentLnSpark || params.paymentLnZap || params.paymentLnNwc) {
			deps.evolu.upsert("paymentWatchingState", {
				id,
				verifiedAt: null,
				proveType: null,
				transactionId: null,
				stoppedAt: null,
				stopReason: null,
			});
		}

		return id;
	};

export const createPaymentWithDefaultMethods =
	(deps: EvoluDep & NdkDep) =>
	async (params: CreatePaymentWithDefaultMethodsParams) => {
		const { amountInBtc } = params;
		const defaultMethods = await deps.evolu.loadQuery(
			createPaymentDefaultMethodsQuery({
				onlyActive: true,
			}),
		);
		const usedTypes = new Set<string>();

		let paymentLnZap:
			| Omit<
					EvoluSchemaType["paymentLnZap"],
					| "id"
					| "expirationIn"
					| "paymentHash"
					| "lnInvoice"
					| "privateKey"
					| "walletPubkey"
			  >
			| undefined;
		let paymentLnSpark:
			| Omit<
					EvoluSchemaType["paymentLnSpark"],
					"id" | "expirationIn" | "paymentHash" | "lnInvoice" | "sparkInvoiceId"
			  >
			| undefined;
		let paymentLnNwc:
			| Omit<
					EvoluSchemaType["paymentLnNwc"],
					"id" | "expirationIn" | "paymentHash" | "lnInvoice"
			  >
			| undefined;
		let paymentBankTransferCZ:
			| Omit<EvoluSchemaType["paymentBankTransferCZ"], "id">
			| undefined;
		let paymentCash: Omit<EvoluSchemaType["paymentCash"], "id"> | undefined;

		for (const defaultMethod of defaultMethods) {
			if (usedTypes.has(defaultMethod.type)) {
				throw new Error(
					`Duplicate active default payment method type: ${defaultMethod.type}`,
				);
			}

			usedTypes.add(defaultMethod.type);

			if (defaultMethod.accountTag === null) {
				continue;
			}

			if (defaultMethod.type === PaymentDefaultMethodType.Cash) {
				if (defaultMethod.accountTag !== "accountCashRegister") {
					throw new Error(
						"Cash payment default method must target a cash account.",
					);
				}

				paymentCash = {
					accountId: defaultMethod.accountId,
				};
				continue;
			}

			if (defaultMethod.type === PaymentDefaultMethodType.BankTransferCZ) {
				if (
					defaultMethod.accountTag !== "accountIban" ||
					defaultMethod.accountIban === null
				) {
					throw new Error(
						"Bank transfer default method must target an account with IBAN.",
					);
				}

				paymentBankTransferCZ = {
					iban: defaultMethod.accountIban,
					variableSymbol: VariableSymbol("1"),
				};
				continue;
			}

			if (defaultMethod.type !== PaymentDefaultMethodType.BtcLn) {
				continue;
			}

			if (defaultMethod.accountTag === "accountLud16") {
				if (amountInBtc === undefined) {
					throw new Error("BTC amount is required for BTC LN payment methods.");
				}
				paymentLnZap = {
					accountId: defaultMethod.accountId,
					amount: amountInBtc,
				};
				continue;
			}

			if (defaultMethod.accountTag === "accountSpark") {
				if (amountInBtc === undefined) {
					throw new Error("BTC amount is required for BTC LN payment methods.");
				}
				paymentLnSpark = {
					accountId: defaultMethod.accountId,
					amount: amountInBtc,
				};
				continue;
			}

			if (defaultMethod.accountTag === "accountNwc") {
				if (amountInBtc === undefined) {
					throw new Error("BTC amount is required for BTC LN payment methods.");
				}
				paymentLnNwc = {
					accountId: defaultMethod.accountId,
					amount: amountInBtc,
				};
				continue;
			}

			throw new Error(
				"BTC LN payment default method must target an LN account.",
			);
		}

		const commonParams = {
			payment: params.payment,
			webData: params.webData,
			tipAmount: params.tipAmount,
			paymentLnZap,
			paymentLnSpark,
			paymentLnNwc,
			paymentBankTransferCZ,
			paymentCash,
		} satisfies Omit<CreatePaymentParams, "items" | "totalAmount">;

		if ("items" in params && params.items !== undefined) {
			return await createPayment(deps)({
				...commonParams,
				items: params.items,
			});
		}

		return await createPayment(deps)({
			...commonParams,
			totalAmount: params.totalAmount,
		});
	};

export const stopPaymentWatching =
	(deps: EvoluDep) =>
	async (params: { paymentId: Id; reason: PaymentWatchingStopReason }) => {
		const rows = await deps.evolu.loadQuery(
			createQuery((db) =>
				db
					.selectFrom("paymentWatchingState")
					.select([
						"paymentWatchingState.verifiedAt as verifiedAt",
						"paymentWatchingState.stoppedAt as stoppedAt",
					] as const)
					.where("paymentWatchingState.isDeleted", "is not", sqliteTrue)
					.where("paymentWatchingState.id", "=", params.paymentId)
					.limit(1),
			),
		);
		const paymentWatchingState = rows[0];

		if (
			paymentWatchingState === undefined ||
			paymentWatchingState.verifiedAt !== null ||
			paymentWatchingState.stoppedAt !== null
		) {
			return false;
		}

		deps.evolu.upsert("paymentWatchingState", {
			id: params.paymentId,
			stoppedAt: Date.now(),
			stopReason: params.reason,
		});

		return true;
	};

const createSparkPayment =
	(deps: EvoluDep & NdkDep) =>
	async (params: { accountId: Id; amountInSats: NonNegativeInteger }) => {
		const accounts = await deps.evolu.loadQuery(
			createQuery((db) =>
				db
					.selectFrom("account")
					.leftJoin("accountSpark", "accountSpark.id", "account.id")
					.select([
						"account._tag as _tag",
						"accountSpark.mnemonic as mnemonic",
					] as const)
					.where("account.isDeleted", "is not", sqliteTrue)
					.where("account.id", "=", params.accountId),
			),
		);

		const account = accounts[0];
		if (account === undefined) {
			return;
		}

		if (account._tag !== "accountSpark" || !account.mnemonic) {
			return;
		}

		const { wallet } = await SparkWallet.initialize({
			mnemonicOrSeed: account.mnemonic,
			options: {
				network: "MAINNET",
			},
		});

		const invoice = await wallet.createLightningInvoice({
			amountSats: Number(params.amountInSats),
			expirySeconds: 3600, // 1 hour
		});

		return {
			lnInvoice: NonEmptyString(invoice.invoice.encodedInvoice),
			sparkInvoiceId: NonEmptyString(invoice.id),
			expirationAt: new Date(invoice.invoice.expiresAt),
		} as const;
	};

const createNwcPayment =
	(deps: EvoluDep) =>
	async (params: { accountId: Id; amountInSats: NonNegativeInteger }) => {
		const accounts = await deps.evolu.loadQuery(
			createQuery((db) =>
				db
					.selectFrom("account")
					.innerJoin("accountNwc", "accountNwc.id", "account.id")
					.select([
						"account._tag as _tag",
						"accountNwc.credentials as credentials",
					] as const)
					.where("account.isDeleted", "is not", sqliteTrue)
					.where("accountNwc.isDeleted", "is not", sqliteTrue)
					.where("account.id", "=", params.accountId)
					.where("accountNwc.credentials", "is not", null)
					.$narrowType<{
						_tag: KyselyNotNull;
						credentials: KyselyNotNull;
					}>(),
			),
		);

		const account = accounts[0];
		if (account === undefined) {
			return;
		}

		if (account._tag !== "accountNwc") {
			return;
		}

		const btcWalletAdapter = getBtcWalletAdapter("accountNwc");
		const invoice = await btcWalletAdapter.receiveInvoice({
			config: {
				id: params.accountId,
				credentials: account.credentials,
			},
			input: {
				amountSats: params.amountInSats,
			},
		});

		return {
			lnInvoice: invoice.invoice,
			expirationAt: new Date(invoice.expiresAt),
		} as const;
	};
