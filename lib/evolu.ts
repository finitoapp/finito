import {
	createAppOwner,
	createEvolu,
	createIdFromString,
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

const RawSchema: Record<
	string,
	| {
			id: typeof Id;
			payload: typeof NonEmptyString;
	  }
	| Readonly<Record<string, unknown>>
> = {};

const CategoryId = id("Category");

// const Schema = RawSchema;
export const Schema = {
	...RawSchema,
	category: {
		id: CategoryId,
		name: NonEmptyTrimmedString100,
	},
	item: {
		id: Id,
		categoryId: nullOr(CategoryId),
		label: NonEmptyTrimmedString100,
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
		sourceItemId: nullOr(Id),
		label: NonEmptyTrimmedString100,
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
		rate: NonNegativeNumber,
	},
	reservation: {
		id: Id,
		tableId: nullOr(Id),
		note: nullOr(NonEmptyTrimmedString1000),
		_tag: NonEmptyTrimmedString100,
		startAt: NonNegativeInt,
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
	notification: {
		id: Id,
		type: NonEmptyTrimmedString100,
	},
	notificationVerifyPayment: {
		id: Id,
		paymentId: Id,
	},
	notificationBackgroundTableProcessing: {
		id: Id,
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
		numberOfSecondsBetweenChecks: PositiveInt,
	},
	fioPluginToken: {
		id: Id,
		fioPluginId: Id,
		token: NonEmptyTrimmedString100,
	},
	invoiceNumberSeries: {
		id: Id,
		serialNumberDigits: PositiveInt,
		yearFormat: NonEmptyTrimmedString100,
		monthFormat: NonEmptyTrimmedString100,
		dayFormat: NonEmptyTrimmedString100,
		prefix: nullOr(NonEmptyTrimmedString100),
	},
	invoiceLastNumber: {
		id: Id,
		serialNumber: NonNegativeInt,
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
		defaultPaymentMethodMethod: nullOr(NonEmptyTrimmedString100),
		defaultPaymentMethodBankAccountKey: nullOr(Id),
		defaultPaymentMethod: NonEmptyTrimmedString100,
		defaultBankTransferCzKey: nullOr(Id),
		defaultLnZapKey: nullOr(Id),
		defaultLnSparkKey: nullOr(Id),
		invoiceEmailSettingsEnable: SqliteBoolean,
		invoiceEmailSettingsSubject: nullOr(NonEmptyTrimmedString100),
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
		amountExpectedToPayValue: nullOr(NonNegativeInt),
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
		type: NonEmptyTrimmedString100,
		billCurrency: NonEmptyTrimmedString100,
		billAllowTip: SqliteBoolean,
		merchantName: nullOr(NonEmptyTrimmedString100),
		onSuccessfulPaymentTag: nullOr(NonEmptyTrimmedString100),
		onSuccessfulPaymentRedirectUrl: nullOr(NonEmptyString),
		privateKey: NonEmptyString,
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
		lnInvoice: NonEmptyString,
		walletPubkey: NonEmptyString,
		amount: NonNegativeInt,
		expirationIn: NonNegativeInt,
	},
	paymentLnSpark: {
		id: Id,
		accountId: Id,
		lnInvoice: NonEmptyString,
		sparkInvoiceId: NonEmptyString,
		amount: NonNegativeInt,
		expirationIn: NonNegativeInt,
	},
	paymentBankTransferCZ: {
		id: Id,
		iban: NonEmptyTrimmedString100,
		variableSymbol: NonEmptyTrimmedString100,
	},
	paymentCash: {
		id: Id,
	},
	paymentStatus: {
		id: Id,
		status: NonEmptyTrimmedString100,
		proveType: nullOr(NonEmptyTrimmedString100),
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
