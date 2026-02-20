import {
	createAppOwner,
	createEvolu,
	createIdFromString,
	Int,
	id,
	type Mnemonic,
	mnemonicToOwnerSecret,
	NonEmptyString,
	NonEmptyTrimmedString100,
	NonEmptyTrimmedString1000,
	NonNegativeInt,
	NonNegativeNumber,
	nullOr,
	type OwnerTransport,
	PositiveInt,
	type Evolu as RawEvolu,
	SimpleName,
	SqliteBoolean,
} from "@evolu/common";
import { evoluReactWebDeps } from "@evolu/react-web";
import { Id } from "@/lib/evolu-types";

const CategoryId = id("Category");

// const Schema = RawSchema;
export const Schema = {
	category: {
		id: CategoryId,
		name: NonEmptyTrimmedString100,
	},
	item: {
		id: Id,
		categoryId: nullOr(CategoryId),
		label: NonEmptyTrimmedString100,
		// Stored in minor units for `priceCurrency` (e.g. cents, satoshis).
		priceValue: NonNegativeInt,
		priceCurrency: NonEmptyTrimmedString100,
		unitOfMeasure: nullOr(NonEmptyTrimmedString100),
		internalCode: nullOr(NonEmptyTrimmedString100),
		productCodeType: nullOr(NonEmptyTrimmedString100),
		productCodeValue: nullOr(NonEmptyTrimmedString100),
	},
	menu: {
		id: Id,
		name: NonEmptyTrimmedString100,
		// Workflow state of menu publication (draft/published/archived...).
		status: NonEmptyTrimmedString100,
		validFrom: nullOr(NonNegativeInt),
		validTo: nullOr(NonNegativeInt),
		publishedAt: nullOr(NonNegativeInt),
	},
	menuCategory: {
		id: Id,
		menuId: Id,
		name: NonEmptyTrimmedString100,
	},
	menuItem: {
		id: Id,
		menuCategoryId: Id,
		// Optional link to source catalog item when menu item is derived from `item`.
		sourceItemId: nullOr(Id),
		label: NonEmptyTrimmedString100,
		// Stored in minor units for `priceCurrency`.
		priceValue: NonNegativeInt,
		priceCurrency: NonEmptyTrimmedString100,
		unitOfMeasure: nullOr(NonEmptyTrimmedString100),
		internalCode: nullOr(NonEmptyTrimmedString100),
		productCodeType: nullOr(NonEmptyTrimmedString100),
		productCodeValue: nullOr(NonEmptyTrimmedString100),
	},
	table: {
		id: Id,
		label: NonEmptyTrimmedString100,
		numberOfSeats: PositiveInt,
	},
	tableCode: {
		id: Id,
		tableId: Id,
		code: NonEmptyTrimmedString100,
	},
	posBill: {
		id: Id,
		displayId: PositiveInt,
		label: nullOr(NonEmptyTrimmedString100),
		currency: NonEmptyTrimmedString100,
		tableId: nullOr(Id),
	},
	posBillItem: {
		id: Id,
		billId: Id,
		sourceItemId: NonEmptyString,
		name: NonEmptyString,
		price: NonNegativeNumber,
		quantity: PositiveInt,
		currency: NonEmptyTrimmedString100,
	},
	posBillRate: {
		id: Id,
		billId: Id,
		currency: NonEmptyTrimmedString100,
		// Exchange rate from bill currency to `currency`.
		rate: NonNegativeNumber,
	},
	reservation: {
		id: Id,
		tableId: nullOr(Id),
		note: nullOr(NonEmptyTrimmedString1000),
		// Reservation type discriminator (booking/block/...).
		_tag: NonEmptyTrimmedString100,
		// Epoch milliseconds.
		startAt: NonNegativeInt,
		// Epoch milliseconds.
		endAt: NonNegativeInt,
	},
	reservationBooking: {
		id: Id,
		name: NonEmptyTrimmedString100,
		phone: nullOr(NonEmptyTrimmedString100),
		email: nullOr(NonEmptyTrimmedString100),
		numberOfPeople: PositiveInt,
		approvalStatus: NonEmptyTrimmedString100,
		serviceStatus: NonEmptyTrimmedString100,
		statusReason: nullOr(NonEmptyTrimmedString1000),
		source: nullOr(NonEmptyTrimmedString100),
	},
	reservationBlock: {
		id: Id,
		label: NonEmptyTrimmedString100,
	},
	account: {
		id: Id,
		name: NonEmptyTrimmedString100,
		// Account kind discriminator (iban/lud16/spark/nwc/cashRegister...).
		_tag: NonEmptyTrimmedString100,
	},
	accountIban: {
		id: Id,
		iban: NonEmptyTrimmedString100,
		currency: NonEmptyTrimmedString100,
	},
	accountLud16: {
		id: Id,
		lud16: NonEmptyTrimmedString100,
	},
	accountSpark: {
		id: Id,
		mnemonic: NonEmptyTrimmedString1000,
	},
	accountNwc: {
		id: Id,
		credentials: NonEmptyTrimmedString100,
	},
	accountCashRegister: {
		id: Id,
		currency: NonEmptyTrimmedString100,
	},
	transaction: {
		id: Id,
		// Logical account this transaction belongs to (bank, LN wallet, cash register...).
		accountId: Id,
		// Transaction kind discriminator (incoming/outgoing/internal transfer legs...).
		_tag: NonEmptyTrimmedString100,
		// Signed amount in the smallest unit of account currency.
		amount: Int,
		// Epoch milliseconds.
		occurredAt: NonNegativeInt,
		note: nullOr(NonEmptyTrimmedString1000),
		// Shared id for both legs of one internal transfer.
		internalTransferGroupId: nullOr(Id),
	},
	reconciliationClaim: {
		id: Id,
		// Source of settlement evidence (bankTransaction/manual/cash/terminal/...).
		sourceType: NonEmptyTrimmedString100,
		// Identifier unique within `sourceType`. For manual sourceType use the same value as reconciliationClaim.id
		sourceId: Id,
		// Target entity type currently expected as payment or invoice.
		entityType: NonEmptyTrimmedString100,
		entityId: Id,
		// Confidence score used by reconciliation ordering.
		confidence: NonNegativeNumber,
		// Matching or override rule identifier.
		rule: NonEmptyTrimmedString100,
		// Optional actor/process identifier that authored this claim.
		createdBy: nullOr(NonEmptyTrimmedString100),
	},
	reconciliationClaimAllocation: {
		id: Id,
		// FK-like reference to reconciliationClaim.id.
		claimId: Id,
		// Allocation bucket: product/tip/overpayment/refund.
		componentType: NonEmptyTrimmedString100,
		// Signed minor units (allows correction rows).
		amount: Int,
	},
	transactionIban: {
		id: Id,
		variableSymbol: nullOr(NonEmptyTrimmedString100),
		constantSymbol: nullOr(NonEmptyTrimmedString100),
		specificSymbol: nullOr(NonEmptyTrimmedString100),
		// Provider-specific payment reference from bank statement.
		bankReference: nullOr(NonEmptyTrimmedString1000),
	},
	transactionLud16: {
		id: Id,
		// Raw BOLT11 invoice, optional for imported transactions.
		lnInvoice: nullOr(NonEmptyString),
		// Payment hash for LN reconciliation.
		paymentHash: NonEmptyString,
	},
	transactionSpark: {
		id: Id,
		// Transfer id from Spark API for deduplication.
		sparkTransferId: NonEmptyTrimmedString100,
		lnInvoice: NonEmptyString,
		// Proof of settlement returned by Spark.
		preImage: NonEmptyString,
		// Payment hash for LN reconciliation.
		paymentHash: NonEmptyString,
	},
	transactionNwc: {
		id: Id,
		nwcEventId: nullOr(NonEmptyString),
		nwcRequestId: nullOr(NonEmptyString),
	},
	transactionCashRegister: {
		id: Id,
	},
	notification: {
		id: Id,
		// Notification kind discriminator consumed by notification center/background jobs.
		type: NonEmptyTrimmedString100,
	},
	notificationVerifyPayment: {
		id: Id,
		// Points to `payment.id` that should be re-verified asynchronously.
		paymentId: Id,
	},
	notificationBackgroundTableProcessing: {
		id: Id,
		// Marker row used to trigger one background table processing cycle.
	},
	client: {
		id: Id,
		name: NonEmptyTrimmedString100,
		label: nullOr(NonEmptyTrimmedString100),
		email: nullOr(NonEmptyTrimmedString100),
		countryCode: NonEmptyTrimmedString100,
	},
	clientAddress: {
		id: Id,
		street: NonEmptyTrimmedString100,
		descriptiveNumber: NonEmptyTrimmedString100,
		city: NonEmptyTrimmedString100,
		postalCode: NonEmptyTrimmedString100,
	},
	clientCz: {
		id: Id,
		identificationNumber: nullOr(NonEmptyTrimmedString100),
		vatNumber: nullOr(NonEmptyTrimmedString100),
		caseNumber: nullOr(NonEmptyTrimmedString100),
	},
	billingInfo: {
		id: Id,
		name: NonEmptyTrimmedString100,
		label: nullOr(NonEmptyTrimmedString100),
		email: nullOr(NonEmptyTrimmedString100),
		countryCode: NonEmptyTrimmedString100,
	},
	billingInfoAddress: {
		id: Id,
		street: NonEmptyTrimmedString100,
		descriptiveNumber: NonEmptyTrimmedString100,
		city: NonEmptyTrimmedString100,
		postalCode: NonEmptyTrimmedString100,
	},
	billingInfoCz: {
		id: Id,
		vatPayer: SqliteBoolean,
		identificationNumber: NonEmptyTrimmedString100,
		vatNumber: nullOr(NonEmptyTrimmedString100),
		caseNumber: nullOr(NonEmptyTrimmedString100),
	},
	fioPlugin: {
		id: Id,
		apiUrl: NonEmptyTrimmedString100,
		// Polling interval in seconds.
		numberOfSecondsBetweenChecks: PositiveInt,
		// Hard switch for FIO sync background process.
		isActive: SqliteBoolean,
	},
	fioPluginToken: {
		id: Id,
		// FK to owning FIO plugin configuration.
		fioPluginId: Id,
		token: NonEmptyTrimmedString100,
	},
	invoiceNumberSeries: {
		id: Id,
		// Number of digits used for left-padded sequence in generated invoice number.
		serialNumberDigits: PositiveInt,
		yearFormat: NonEmptyTrimmedString100,
		monthFormat: NonEmptyTrimmedString100,
		dayFormat: NonEmptyTrimmedString100,
		prefix: nullOr(NonEmptyTrimmedString100),
	},
	invoiceLastNumber: {
		id: Id,
		// Last used serial number for invoice generation.
		serialNumber: NonNegativeInt,
		// Anchor date used for reset logic depending on configured formats.
		date: nullOr(NonEmptyTrimmedString100),
	},
	smtp: {
		id: Id,
		server: NonEmptyTrimmedString100,
		port: PositiveInt,
		username: NonEmptyTrimmedString100,
		password: NonEmptyTrimmedString100,
		name: nullOr(NonEmptyTrimmedString100),
		email: NonEmptyTrimmedString100,
	},
	billingSettings: {
		id: Id,
		defaultInvoiceDueDateDays: NonNegativeInt,
		defaultCurrency: NonEmptyTrimmedString100,
		defaultTimezone: NonEmptyTrimmedString100,
		// Persisted payment method enum used as default for new invoices/payments.
		defaultPaymentMethodMethod: nullOr(NonEmptyTrimmedString100),
		// Optional FK to account row used for bank transfer defaults.
		defaultPaymentMethodBankAccountKey: nullOr(Id),
		defaultPaymentMethod: NonEmptyTrimmedString100,
		// Optional FK to payment option config rows.
		defaultBankTransferCzKey: nullOr(Id),
		defaultLnZapKey: nullOr(Id),
		defaultLnSparkKey: nullOr(Id),
		invoiceEmailSettingsEnable: SqliteBoolean,
		invoiceEmailSettingsSubject: nullOr(NonEmptyTrimmedString100),
		// Templated email body that can include placeholders.
		invoiceEmailSettingsBody: nullOr(NonEmptyString),
	},
	billingSettingsTaxRate: {
		id: Id,
		billingSettingsId: Id,
		name: nullOr(NonEmptyTrimmedString100),
		rate: NonNegativeInt,
	},
	invoice: {
		id: Id,
		invoiceId: NonEmptyTrimmedString100,
		invoiceNumber: NonEmptyTrimmedString100,
		issueDate: NonEmptyTrimmedString100,
		dueDate: NonEmptyTrimmedString100,
		currency: NonEmptyTrimmedString100,
		paymentMethod: NonEmptyTrimmedString100,
		paymentIban: nullOr(NonEmptyTrimmedString100),
	},
	invoiceCustomerBillingInfo: {
		id: Id,
		name: NonEmptyTrimmedString100,
		label: nullOr(NonEmptyTrimmedString100),
		email: nullOr(NonEmptyTrimmedString100),
		countryCode: NonEmptyTrimmedString100,
	},
	invoiceCustomerBillingInfoAddress: {
		id: Id,
		street: NonEmptyTrimmedString100,
		descriptiveNumber: NonEmptyTrimmedString100,
		city: NonEmptyTrimmedString100,
		postalCode: NonEmptyTrimmedString100,
	},
	invoiceCustomerBillingInfoCz: {
		id: Id,
		identificationNumber: NonEmptyTrimmedString100,
		vatNumber: nullOr(NonEmptyTrimmedString100),
		caseNumber: nullOr(NonEmptyTrimmedString100),
	},
	invoiceSupplierBillingInfo: {
		id: Id,
		name: NonEmptyTrimmedString100,
		label: nullOr(NonEmptyTrimmedString100),
		email: nullOr(NonEmptyTrimmedString100),
		countryCode: NonEmptyTrimmedString100,
	},
	invoiceSupplierBillingInfoAddress: {
		id: Id,
		street: NonEmptyTrimmedString100,
		descriptiveNumber: NonEmptyTrimmedString100,
		city: NonEmptyTrimmedString100,
		postalCode: NonEmptyTrimmedString100,
	},
	invoiceSupplierBillingInfoCz: {
		id: Id,
		vatPayer: SqliteBoolean,
		identificationNumber: NonEmptyTrimmedString100,
		vatNumber: nullOr(NonEmptyTrimmedString100),
		caseNumber: nullOr(NonEmptyTrimmedString100),
	},
	invoiceItem: {
		id: Id,
		invoiceId: Id,
		label: NonEmptyTrimmedString100,
		price: NonNegativeInt,
		quantity: NonNegativeInt,
		unitOfMeasure: nullOr(NonEmptyTrimmedString100),
	},
	invoiceStatus: {
		id: Id,
		status: NonEmptyTrimmedString100,
	},
	paymentInit: {
		id: Id,
		tip: NonNegativeInt,
		currency: NonEmptyTrimmedString100,
		paymentOptionType: NonEmptyTrimmedString100,
		merchantName: nullOr(NonEmptyTrimmedString100),
		merchantPhone: nullOr(NonEmptyTrimmedString100),
	},
	paymentInitItem: {
		id: Id,
		paymentInitId: Id,
		itemId: NonEmptyString,
		price: NonNegativeInt,
		quantity: NonNegativeInt,
	},
	paymentReady: {
		id: Id,
		billTip: nullOr(NonNegativeInt),
		billCurrency: NonEmptyTrimmedString100,
		// Expected amount to settle in smallest unit for `amountExpectedToPayCurrency`.
		amountExpectedToPayValue: nullOr(NonNegativeInt),
		// Optional conversion rate used to derive expected amount.
		amountExpectedToPayRate: nullOr(NonNegativeInt),
		amountExpectedToPayCurrency: nullOr(NonEmptyTrimmedString100),
	},
	paymentReadyItem: {
		id: Id,
		paymentReadyId: Id,
		itemId: NonEmptyString,
		price: NonNegativeInt,
		quantity: NonNegativeInt,
		label: NonEmptyString,
	},
	paymentFinished: {
		id: Id,
		type: NonEmptyTrimmedString100,
		reason: nullOr(NonEmptyString),
		refundType: nullOr(NonEmptyTrimmedString100),
		refundLnInvoice: nullOr(NonEmptyString),
	},
	payment: {
		id: Id,
		// Payment flow type discriminator (static/dynamic/...).
		type: NonEmptyTrimmedString100,
		billCurrency: NonEmptyTrimmedString100,
		billAllowTip: SqliteBoolean,
		// Optional expected tip amount in minor units used for reconciliation split.
		expectedTipAmount: nullOr(NonNegativeInt),
		merchantName: nullOr(NonEmptyTrimmedString100),
		// Optional tag/event emitted after successful settlement.
		onSuccessfulPaymentTag: nullOr(NonEmptyTrimmedString100),
		// Optional redirect after successful settlement.
		onSuccessfulPaymentRedirectUrl: nullOr(NonEmptyString),
		privateKey: NonEmptyString,
		// External event id used by web payment flow.
		webPaymentEventId: NonEmptyString,
	},
	paymentBillItem: {
		id: Id,
		paymentId: Id,
		price: NonNegativeInt,
		quantity: NonNegativeInt,
		label: NonEmptyTrimmedString100,
		optionalityChecked: nullOr(NonNegativeInt),
	},
	paymentLnZap: {
		id: Id,
		// Target account for mirrored incoming LN transaction after verification.
		accountId: Id,
		lnInvoice: NonEmptyString,
		// Payment hash for LN reconciliation.
		paymentHash: NonEmptyString,
		walletPubkey: NonEmptyString,
		// Satoshis.
		amount: NonNegativeInt,
		// UNIX timestamp in seconds (invoice expiry).
		expirationIn: NonNegativeInt,
	},
	paymentLnSpark: {
		id: Id,
		accountId: Id,
		lnInvoice: NonEmptyString,
		// Payment hash for LN reconciliation.
		paymentHash: NonEmptyString,
		// Identifier returned by Spark invoice API.
		sparkInvoiceId: NonEmptyString,
		// Satoshis.
		amount: NonNegativeInt,
		// UNIX timestamp in seconds (invoice expiry).
		expirationIn: NonNegativeInt,
	},
	paymentBankTransferCZ: {
		id: Id,
		iban: NonEmptyTrimmedString100,
		variableSymbol: NonEmptyTrimmedString100,
	},
	paymentCash: {
		id: Id,
		// Cash register account where the cash settlement is recorded.
		accountId: nullOr(Id),
	},
	paymentStatus: {
		id: Id,
		status: NonEmptyTrimmedString100,
		// How status was proven (manual/spark/fio/ln-zap/...).
		proveType: nullOr(NonEmptyTrimmedString100),
	},
	paymentWatchingState: {
		id: Id,
		// Epoch milliseconds when watcher marked payment as verified.
		verifiedAt: nullOr(NonNegativeInt),
		// Verification source/type (lnZap/lnSpark/...).
		proveType: nullOr(NonEmptyTrimmedString100),
		// Related transaction id created by verification process.
		transactionId: nullOr(Id),
		// Epoch milliseconds when active watching was interrupted.
		stoppedAt: nullOr(NonNegativeInt),
		// Reason for stopping active watching (manual/timeout/deleted/...).
		stopReason: nullOr(NonEmptyTrimmedString100),
	},
};

export const createAppEvolu = (props: {
	mnemonic: Mnemonic;
	transports: ReadonlyArray<OwnerTransport>;
}) => {
	const evolu = createEvolu(evoluReactWebDeps)(Schema, {
		name: SimpleName.orThrow(`Finito${createIdFromString(props.mnemonic)}`),
		// enableLogging: true,
		transports: props.transports,
		externalAppOwner: createAppOwner(mnemonicToOwnerSecret(props.mnemonic)),
		indexes: (create) => [
			create(`item_categoryId`).on(`item`).column("categoryId"),
			create(`menuCategory_menuId`).on(`menuCategory`).column("menuId"),
			create(`menuItem_menuCategoryId`).on(`menuItem`).column("menuCategoryId"),
			create(`tableCode_tableId`).on(`tableCode`).column("tableId"),
			create(`posBill_tableId`).on(`posBill`).column("tableId"),
			create(`posBillItem_billId`).on(`posBillItem`).column("billId"),
			create(`posBillRate_billId`).on(`posBillRate`).column("billId"),
			create(`posBillRate_billId_currency`)
				.on(`posBillRate`)
				.column("billId")
				.column("currency"),
			create(`reservation_tableId`).on(`reservation`).column("tableId"),
			create(`reservation_tag`).on(`reservation`).column("_tag"),
			create(`reservation_startAt`).on(`reservation`).column("startAt"),
			create(`reservation_endAt`).on(`reservation`).column("endAt"),
			create(`reservationBooking_approvalStatus`)
				.on(`reservationBooking`)
				.column("approvalStatus"),
			create(`reservationBooking_serviceStatus`)
				.on(`reservationBooking`)
				.column("serviceStatus"),
			create(`transaction_accountId`).on(`transaction`).column("accountId"),
			create(`transaction_tag`).on(`transaction`).column("_tag"),
			create(`transaction_occurredAt`).on(`transaction`).column("occurredAt"),
			create(`transaction_accountId_occurredAt`)
				.on(`transaction`)
				.column("accountId")
				.column("occurredAt"),
			create(`transaction_internalTransferGroupId`)
				.on(`transaction`)
				.column("internalTransferGroupId"),
			create(`reconciliationClaim_sourceType_sourceId`)
				.on(`reconciliationClaim`)
				.column("sourceType")
				.column("sourceId"),
			create(`reconciliationClaim_entityType_entityId`)
				.on(`reconciliationClaim`)
				.column("entityType")
				.column("entityId"),
			create(`reconciliationClaimAllocation_claimId`)
				.on(`reconciliationClaimAllocation`)
				.column("claimId"),
			create(`reconciliationClaimAllocation_claimId_componentType`)
				.on(`reconciliationClaimAllocation`)
				.column("claimId")
				.column("componentType"),
			create(`paymentLnZap_paymentHash`)
				.on(`paymentLnZap`)
				.column("paymentHash"),
			create(`paymentLnSpark_paymentHash`)
				.on(`paymentLnSpark`)
				.column("paymentHash"),
			create(`fioPluginToken_fioPluginId`)
				.on(`fioPluginToken`)
				.column("fioPluginId"),
			create(`billingSettingsTaxRate_billingSettingsId`)
				.on(`billingSettingsTaxRate`)
				.column("billingSettingsId"),
			create(`invoiceItem_invoiceId`).on(`invoiceItem`).column("invoiceId"),
			create(`paymentInitItem_paymentInitId`)
				.on(`paymentInitItem`)
				.column("paymentInitId"),
			create(`paymentReadyItem_paymentReadyId`)
				.on(`paymentReadyItem`)
				.column("paymentReadyId"),
			create(`paymentBillItem_paymentId`)
				.on(`paymentBillItem`)
				.column("paymentId"),
			// Partial index for actively watched payments (verifiedAt/stoppedAt are null).
			create(`paymentWatchingState_watching_by_timestamps`)
				.on(`paymentWatchingState`)
				.column("verifiedAt")
				.column("stoppedAt")
				.where("verifiedAt", "is", null)
				.where("stoppedAt", "is", null),
		],
	});

	(async () => {
		console.log("appOwner", await evolu.appOwner, props.mnemonic);
	})();

	// evolu.resetAppOwner();

	// (async () => {
	// 	const historyQuery = evolu.createQuery((db) =>
	// 		db.selectFrom("evolu_history").selectAll().orderBy("timestamp", "desc"),
	// 	);
	//
	// 	const history = await evolu.loadQuery(historyQuery);
	// 	console.log("history", history);
	// })();

	evolu.subscribeError(() => {
		const error = evolu.getError();
		if (!error) return;

		alert("🚨 Evolu error occurred! Check the console.");
		// eslint-disable-next-line no-console
		console.error(error);
	});

	return evolu;
};

export type EvoluSchema = typeof Schema;
export type Evolu = RawEvolu<EvoluSchema>;
