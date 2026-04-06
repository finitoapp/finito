import {
	AppName,
	createAppOwner,
	createEvolu,
	createIdFromString,
	createQueryBuilder,
	getOrThrow,
	type Mnemonic,
	mnemonicToOwnerSecret,
	type OwnerTransport,
	type Evolu as RawEvolu,
	type EvoluSchema as RawEvoluSchema,
	type StandardSchemaV1,
} from "@evolu/common";
import { createEvoluDeps, createRun } from "@evolu/web";
import { z } from "zod";
import { InvoicePaymentMethod } from "@/lib/evolu/model/invoice";
import { MenuStatus } from "@/lib/evolu/model/menu";
import { PaymentMethod } from "@/lib/evolu/model/payment";
import { PaymentDefaultMethodType } from "@/lib/evolu/model/payment-default-method";
import { PaymentWatchingStopReason } from "@/lib/evolu/model/payment-watching-state";
import { TableIdSchema } from "@/lib/evolu/types";
import {
	ConstantSymbolSchema,
	CountryCode,
	Currency,
	DateStringSchema,
	EmailSchema,
	FiatCurrency,
	HttpsUrlSchema,
	IbanSchema,
	IdentificationNumberCzSchema,
	IntegerSchema,
	NonEmptyString32Schema,
	NonEmptyString255Schema,
	NonEmptyStringSchema,
	NonNegativeIntegerSchema,
	NwcCredentialsSchema,
	PercentSchema,
	PhoneSchema,
	PositiveIntegerSchema,
	PositiveNumberSchema,
	ProductCodeType,
	SpecificSymbolSchema,
	SqliteBoolSchema,
	TimeStringSchema,
	TimestampMsSchema,
	TimestampSecSchema,
	Timezone,
	Uuid7Schema,
	VariableSymbolSchema,
} from "@/lib/shared/types";

const AddressSchema = {
	id: TableIdSchema,
	street: NonEmptyString255Schema.nullable(),
	descriptiveNumber: NonEmptyString32Schema.nullable(),
	city: NonEmptyString255Schema.nullable(),
	postalCode: NonEmptyString32Schema.nullable(),
};

const ContactSchema = {
	id: TableIdSchema,
	name: NonEmptyString255Schema,
	label: NonEmptyString255Schema.nullable(),
	email: EmailSchema.nullable(),
	phone: PhoneSchema.nullable(),
};

const BillingInfoSchema = {
	id: TableIdSchema,
	countryCode: z.enum(CountryCode),
};
const BillingInfoCzSchema = {
	id: TableIdSchema,
	vatPayer: SqliteBoolSchema.nullable(),
	identificationNumber: IdentificationNumberCzSchema.nullable(),
	vatNumber: NonEmptyString255Schema.nullable(),
	caseNumber: NonEmptyString255Schema.nullable(),
};

const NullableTableIdSchema = TableIdSchema.nullable();

const Weekday = {
	mon: "mon",
	tue: "tue",
	wed: "wed",
	thu: "thu",
	fri: "fri",
	sat: "sat",
	sun: "sun",
} as const;

const ItemSchema = {
	id: TableIdSchema,
	label: NonEmptyString255Schema,
	// Stored in minor units for `priceCurrency` (e.g. cents, satoshis).
	price: IntegerSchema,
	unitOfMeasure: NonEmptyStringSchema.nullable(),
	internalCode: NonEmptyStringSchema.nullable(),
	productCodeType: z.enum(ProductCodeType).nullable(),
	productCodeValue: NonEmptyStringSchema.nullable(),
	categoryId: NullableTableIdSchema,
	currency: z.enum(Currency),
} as const;

export const AppSchema = {
	category: {
		id: TableIdSchema,
		deviceId: TableIdSchema.nullable(),
		name: NonEmptyString255Schema,
	},
	device: {
		id: TableIdSchema,
		name: NonEmptyString255Schema,
		deviceType: z.string().nullable(),
		deviceVendor: z.string().nullable(),
		browserName: z.string().nullable(),
		osName: z.string().nullable(),
	},
	catalogItem: {
		...ItemSchema,
		deviceId: TableIdSchema.nullable(),
	},
	item: {
		...ItemSchema,
		// Link to the original catalog item.
		// It can be null when the item is used without original catalog item.
		catalogItemId: NullableTableIdSchema,
	},
	menu: {
		id: TableIdSchema,
		deviceId: TableIdSchema.nullable(),
		name: NonEmptyString255Schema,
		// Workflow state of menu publication.
		status: z.enum(MenuStatus),
		validFrom: TimestampMsSchema.nullable(),
		validTo: TimestampMsSchema.nullable(),
		publishedAt: TimestampMsSchema.nullable(),
	},
	menuCategory: {
		id: TableIdSchema,
		menuId: TableIdSchema,
		name: NonEmptyString255Schema,
	},
	menuItemLine: {
		id: TableIdSchema,
		menuCategoryId: TableIdSchema,
		catalogItemId: NullableTableIdSchema,
		itemId: TableIdSchema,
		// `null` = available` for menu-specific availability.
		availabilityStatus: z.enum(["soldOut", "hidden"]).nullable(),
	},
	table: {
		id: TableIdSchema,
		deviceId: TableIdSchema.nullable(),
		label: NonEmptyString255Schema,
		numberOfSeats: PositiveIntegerSchema,
	},
	tableCode: {
		id: TableIdSchema,
		tableId: TableIdSchema,
		code: NonEmptyString255Schema,
	},
	waiter: {
		id: TableIdSchema,
		deviceId: TableIdSchema.nullable(),
		name: NonEmptyString255Schema,
	},
	// Opening hours evaluation priority (highest to lowest):
	// 1) openingHoursExceptionDay (+ openingHoursExceptionSlot for mode="custom")
	// 2) global holiday policy in openingHoursSettings
	// 3) openingHoursRegularSlot
	openingHoursSettings: {
		id: TableIdSchema,
		deviceId: TableIdSchema.nullable(),
		timezone: z.enum(Timezone),
		holidayMode: z.enum(["manualOnly", "closeOnPublicHolidays"]),
		holidayCountryCode: z.enum(CountryCode).nullable(),
		holidayRegionCode: NonEmptyString32Schema.nullable(),
		holidayObservedMode: z.enum(["none", "observed"]),
	},
	openingHoursRegularSlot: {
		id: TableIdSchema,
		openingHoursSettingsId: TableIdSchema,
		weekday: z.enum(Weekday),
		// Local wall-clock time in openingHoursSettings.timezone.
		openMinute: TimeStringSchema,
		// Local wall-clock time in openingHoursSettings.timezone.
		closeMinute: TimeStringSchema,
		sortOrder: NonNegativeIntegerSchema,
		// Optional seasonal applicability for this regular slot.
		validFrom: DateStringSchema.nullable(),
		// Optional seasonal applicability for this regular slot.
		validTo: DateStringSchema.nullable(),
	},
	openingHoursExceptionDay: {
		id: TableIdSchema,
		openingHoursSettingsId: TableIdSchema,
		date: DateStringSchema,
		mode: z.enum(["closed", "custom"]),
		note: NonEmptyString255Schema.nullable(),
	},
	openingHoursExceptionSlot: {
		id: TableIdSchema,
		openingHoursExceptionDayId: TableIdSchema,
		// Local wall-clock time in openingHoursSettings.timezone.
		openMinute: TimeStringSchema,
		// Local wall-clock time in openingHoursSettings.timezone.
		closeMinute: TimeStringSchema,
		sortOrder: NonNegativeIntegerSchema,
	},
	posBill: {
		id: TableIdSchema,
		deviceId: TableIdSchema.nullable(),
		displayId: PositiveIntegerSchema,
		label: NonEmptyString255Schema.nullable(),
		currency: z.enum(Currency),
		tableId: NullableTableIdSchema,
	},
	posBillItemLine: {
		id: TableIdSchema,
		posBillId: TableIdSchema,
		// Device that created this bill item change event.
		deviceId: TableIdSchema.nullable(),
		// Original catalog item reference kept for audit/debugging.
		// Bill projection intentionally merges by `itemId` only.
		catalogItemId: NullableTableIdSchema,
		// Stable snapshot of the item at the time the change was recorded.
		itemId: TableIdSchema,
		// Append-only change type. Existing rows must never be mutated in place.
		_tag: z.enum(["add", "remove"]),
		// Positive amount of this event in bill currency.
		totalAmount: IntegerSchema,
		// Positive quantity of this event. The sign is represented by `_tag`.
		quantity: PositiveNumberSchema,
	},
	posBillRate: {
		id: TableIdSchema,
		billId: TableIdSchema,
		currency: z.enum(Currency),
		// Exchange rate from bill currency to `currency`.
		rate: z.number(),
	},
	reservation: {
		id: TableIdSchema,
		deviceId: TableIdSchema.nullable(),
		tableId: NullableTableIdSchema,
		note: NonEmptyStringSchema.nullable(),
		// Reservation type discriminator (booking/block/...).
		_tag: z.enum(["booking", "block"]),
		// Epoch milliseconds.
		startAt: TimestampMsSchema,
		// Epoch milliseconds.
		endAt: TimestampMsSchema,
	},
	reservationBooking: {
		id: TableIdSchema,
		name: NonEmptyString255Schema,
		phone: PhoneSchema.nullable(),
		email: EmailSchema.nullable(),
		numberOfPeople: PositiveIntegerSchema,
		approvalStatus: z.enum(["pending", "approved", "rejected"]),
		serviceStatus: z.enum(["upcoming", "seated", "noShow", "completed"]),
		statusReason: NonEmptyStringSchema.nullable(),
		source: z.enum(["manual", "phone", "web"]).nullable(),
	},
	reservationBlock: {
		id: TableIdSchema,
		label: NonEmptyString255Schema,
	},
	account: {
		id: TableIdSchema,
		deviceId: TableIdSchema.nullable(),
		name: NonEmptyString255Schema,
		// Account kind discriminator
		_tag: z.enum([
			"accountIban",
			"accountLud16",
			"accountSpark",
			"accountNwc",
			"accountCashRegister",
		]),
	},
	accountIban: {
		id: TableIdSchema,
		iban: IbanSchema,
		currency: z.enum(FiatCurrency),
	},
	accountLud16: {
		id: TableIdSchema,
		lud16: EmailSchema,
	},
	accountSpark: {
		id: TableIdSchema,
		mnemonic: NonEmptyString255Schema,
	},
	accountNwc: {
		id: TableIdSchema,
		credentials: NwcCredentialsSchema,
	},
	accountCashRegister: {
		id: TableIdSchema,
		currency: z.enum(FiatCurrency),
	},
	transaction: {
		id: TableIdSchema,
		deviceId: TableIdSchema.nullable(),
		// Logical account this transaction belongs to (bank, LN wallet, cash register...).
		accountId: TableIdSchema,
		// Transaction kind discriminator (incoming/outgoing/internal transfer legs...).
		_tag: z.enum([
			"accountSpark",
			"accountLud16",
			"accountIban",
			"accountNwc",
			"accountCashRegister",
		]),
		// Signed amount in the smallest unit of account currency.
		amount: IntegerSchema,
		currency: z.enum(Currency),
		// Epoch milliseconds.
		occurredAt: TimestampMsSchema,
		note: NonEmptyStringSchema.nullable(),
		// Shared id for both legs of one internal transfer.
		internalTransferGroupId: NonEmptyString255Schema.nullable(),
	},
	reconciliationClaim: {
		id: TableIdSchema,
		deviceId: TableIdSchema.nullable(),
		// Source of settlement evidence (bankTransaction/manual/cash/terminal/...).
		sourceType: z.enum(["transaction"]),
		// Identifier unique within `sourceType`. For manual sourceType use the same value as reconciliationClaim.id
		sourceId: TableIdSchema,
		// Target entity type currently expected as payment or invoice.
		entityType: z.enum(["payment", "invoice"]),
		entityId: TableIdSchema,
		// Confidence score used by reconciliation ordering.
		confidence: z.number(),
		// Matching or override rule identifier.
		rule: z.enum(["lnPaymentHash", "manualCashRegisterSettlement"]),
		// Optional actor/process identifier that authored this claim.
		createdBy: z
			.enum([
				"syncLnZapTransfersProcess",
				"syncSparkTransfersProcess",
				"syncNwcTransfersProcess",
				"adminPaymentsDetail",
			])
			.nullable(),
	},
	reconciliationClaimAllocation: {
		id: TableIdSchema,
		// FK-like reference to reconciliationClaim.id.
		claimId: TableIdSchema,
		// Allocation bucket: product/tip/overpayment/refund.
		componentType: z.enum(["product", "tip", "overpayment", "fee"]),
		// Signed minor units (allows correction rows).
		amount: IntegerSchema,
	},
	transactionIban: {
		id: TableIdSchema,
		variableSymbol: VariableSymbolSchema.nullable(),
		constantSymbol: ConstantSymbolSchema.nullable(),
		specificSymbol: SpecificSymbolSchema.nullable(),
		// Provider-specific payment reference from bank statement.
		bankReference: NonEmptyString255Schema.nullable(),
	},
	transactionLud16: {
		id: TableIdSchema,
		// Raw BOLT11 invoice, optional for imported transactions.
		lnInvoice: NonEmptyStringSchema.nullable(),
		// Payment hash for LN reconciliation.
		paymentHash: NonEmptyStringSchema,
	},
	transactionSpark: {
		id: TableIdSchema,
		// Transfer id from Spark API for deduplication.
		sparkTransferId: NonEmptyStringSchema,
		lnInvoice: NonEmptyStringSchema,
		// Proof of settlement returned by Spark.
		preImage: NonEmptyStringSchema,
		// Payment hash for LN reconciliation.
		paymentHash: NonEmptyStringSchema,
	},
	transactionNwc: {
		id: TableIdSchema,
		nwcEventId: NonEmptyStringSchema.nullable(),
		nwcRequestId: NonEmptyStringSchema.nullable(),
	},
	transactionCashRegister: {
		id: TableIdSchema,
	},
	client: {
		id: TableIdSchema,
		deviceId: TableIdSchema.nullable(),
		name: NonEmptyString255Schema,
		label: NonEmptyString255Schema.nullable(),
		email: EmailSchema.nullable(),
		countryCode: z.enum(CountryCode),
	},
	clientAddress: AddressSchema,
	clientCz: {
		id: TableIdSchema,
		vatPayer: SqliteBoolSchema.nullable(),
		identificationNumber: IdentificationNumberCzSchema.nullable(),
		vatNumber: NonEmptyString255Schema.nullable(),
		caseNumber: NonEmptyString255Schema.nullable(),
	},
	contact: {
		...ContactSchema,
		deviceId: TableIdSchema.nullable(),
	},
	contactAccount: {
		id: TableIdSchema,
		contactId: TableIdSchema,
		deviceId: TableIdSchema.nullable(),
		name: NonEmptyString255Schema.nullable(),
		// Account kind discriminator
		_tag: z.enum(["accountIban", "accountLud16"]),
	},
	contactAccountIban: {
		id: TableIdSchema,
		iban: IbanSchema,
		currency: z.enum(FiatCurrency),
	},
	contactAccountLud16: {
		id: TableIdSchema,
		lud16: EmailSchema,
	},
	contactNostr: {
		id: TableIdSchema,
		contactId: TableIdSchema,
		npub: NonEmptyStringSchema,
		name: NonEmptyString255Schema.nullable(),
	},
	contactAddress: AddressSchema,
	contactBillingInfo: {
		id: TableIdSchema,
		countryCode: z.enum(CountryCode),
	},
	contactBillingInfoCz: {
		id: TableIdSchema,
		vatPayer: SqliteBoolSchema.nullable(),
		identificationNumber: IdentificationNumberCzSchema.nullable(),
		vatNumber: NonEmptyString255Schema.nullable(),
		caseNumber: NonEmptyString255Schema.nullable(),
	},
	billingInfo: BillingInfoSchema,
	billingInfoAddress: AddressSchema,
	billingInfoCz: BillingInfoCzSchema,
	fioPlugin: {
		id: TableIdSchema,
		apiUrl: HttpsUrlSchema,
		// Polling interval in seconds.
		numberOfSecondsBetweenChecks: PositiveIntegerSchema,
		// Hard switch for FIO sync background process.
		isActive: SqliteBoolSchema,
	},
	fioPluginToken: {
		id: TableIdSchema,
		// FK to owning FIO plugin configuration.
		fioPluginId: TableIdSchema,
		token: NonEmptyString255Schema,
	},
	invoiceNumberSeries: {
		id: TableIdSchema,
		// Number of digits used for left-padded sequence in generated invoice number.
		serialNumberDigits: PositiveIntegerSchema,
		yearFormat: z.enum(["default", "short"]),
		monthFormat: z.enum(["default", "hidden"]),
		dayFormat: z.enum(["default", "hidden"]),
		prefix: NonEmptyString32Schema.nullable(),
	},
	invoiceLastNumber: {
		id: TableIdSchema,
		// Last used serial number for invoice generation.
		serialNumber: NonNegativeIntegerSchema,
		// Anchor date used for reset logic depending on configured formats.
		date: DateStringSchema.nullable(),
	},
	smtp: {
		id: TableIdSchema,
		server: NonEmptyStringSchema,
		port: PositiveIntegerSchema,
		username: NonEmptyStringSchema,
		password: NonEmptyStringSchema,
		name: NonEmptyStringSchema.nullable(),
		email: EmailSchema,
	},
	aiAssistantSettings: {
		id: TableIdSchema,
		googleApiKey: NonEmptyStringSchema.nullable(),
	},
	billingSettings: {
		id: TableIdSchema,
		ownContactId: TableIdSchema.nullable(),
		defaultCurrency: z.enum(FiatCurrency),
		defaultTimezone: z.enum(Timezone),
		// Optional FK to account row used for bank transfer defaults.
		defaultPaymentMethodBankAccountKey: NullableTableIdSchema,
		defaultPaymentMethod: z.enum(PaymentMethod),
		// Optional FK to payment option config rows.
		defaultBankTransferCzKey: NullableTableIdSchema,
		defaultLnZapKey: NullableTableIdSchema,
		defaultLnSparkKey: NullableTableIdSchema,
	},
	invoiceSettings: {
		id: TableIdSchema,
		defaultDueDateDays: NonNegativeIntegerSchema,
		// Persisted invoice payment method used as default for new invoices.
		defaultPaymentMethod: z.enum(InvoicePaymentMethod).nullable(),
	},
	invoiceEmailSettings: {
		id: TableIdSchema,
		enable: SqliteBoolSchema,
		subject: NonEmptyString255Schema.nullable(),
		// Templated email body that can include placeholders.
		body: NonEmptyStringSchema.nullable(),
	},
	billingSettingsTaxRate: {
		id: TableIdSchema,
		name: NonEmptyString255Schema.nullable(),
		rate: PercentSchema,
	},
	paymentDefaultMethod: {
		id: TableIdSchema,
		type: z.enum(PaymentDefaultMethodType),
		accountId: TableIdSchema,
		pausedAt: TimestampMsSchema.nullable(),
	},
	invoice: {
		id: TableIdSchema,
		deviceId: TableIdSchema.nullable(),
		invoiceId: Uuid7Schema,
		invoiceNumber: NonEmptyString255Schema,
		issueDate: DateStringSchema,
		dueDate: DateStringSchema,
		currency: z.enum(Currency),
		paymentMethod: z.enum(InvoicePaymentMethod),
		paymentIban: IbanSchema.nullable(),
	},
	invoiceCustomer: {
		...ContactSchema,
		sourceContactId: NullableTableIdSchema,
	},
	invoiceCustomerAddress: AddressSchema,
	invoiceCustomerBillingInfo: BillingInfoSchema,
	invoiceCustomerBillingInfoCz: BillingInfoCzSchema,
	invoiceSupplier: {
		...ContactSchema,
		sourceContactId: NullableTableIdSchema,
	},
	invoiceSupplierAddress: AddressSchema,
	invoiceSupplierBillingInfo: BillingInfoSchema,
	invoiceSupplierBillingInfoCz: BillingInfoCzSchema,
	invoiceItemLine: {
		id: TableIdSchema,
		invoiceId: TableIdSchema,
		catalogItemId: NullableTableIdSchema,
		itemId: TableIdSchema,
		quantity: z.number(),
		totalAmount: IntegerSchema, // In invoice currency, not in item currency.
	},
	invoiceWatchingState: {
		id: TableIdSchema,
		// Epoch milliseconds when watcher marked payment as verified.
		verifiedAt: TimestampMsSchema.nullable(),
		// Verification source/type
		proveType: z.enum(["lnZap", "lnSpark"]).nullable(),
		// Related transaction id created by verification process.
		transactionId: NullableTableIdSchema,
		// Epoch milliseconds when active watching was interrupted.
		stoppedAt: TimestampMsSchema.nullable(),
		// Reason for stopping active watching.
		stopReason: z.enum(PaymentWatchingStopReason).nullable(),
	},
	payment: {
		id: TableIdSchema,
		deviceId: TableIdSchema.nullable(),
		// Payment flow type discriminator (static/dynamic/...).
		// type: z.enum(["lnZap", "lnSpark", "bankTransferCZ", "cash"]),
		direction: z.enum(["incoming", "outgoing"]),
		// Includes tipAmount and sum of all paymentItems
		totalAmount: IntegerSchema,
		currency: z.enum(Currency),
		// Optional expected tip amount in minor units.
		tipAmount: NonNegativeIntegerSchema.nullable(),
	},
	paymentCounterparty: {
		...ContactSchema,
		sourceContactId: NullableTableIdSchema,
	},
	paymentWebData: {
		id: TableIdSchema,
		merchantName: NonEmptyStringSchema.nullable(),
		// Optional tag/event emitted after successful settlement.
		onSuccessfulPaymentTag: z.enum(["httpRedirect"]).nullable(),
		// Optional redirect after successful settlement.
		onSuccessfulPaymentRedirectUrl: HttpsUrlSchema.nullable(),
		privateKey: NonEmptyStringSchema,
		// // External event id used by web payment flow.
		webPaymentEventId: NonEmptyStringSchema,
	},
	// It's optional. The payment does not have to contain the definition of the items.
	paymentItemLine: {
		id: TableIdSchema,
		paymentId: TableIdSchema,
		catalogItemId: NullableTableIdSchema,
		itemId: TableIdSchema,
		quantity: z.number(),
		totalAmount: IntegerSchema, // In invoice currency, not in item currency.
		optionalityChecked: NonNegativeIntegerSchema.nullable(),
	},
	paymentLnZap: {
		id: TableIdSchema,
		// Target account for mirrored incoming LN transaction after verification.
		accountId: TableIdSchema,
		lnInvoice: NonEmptyStringSchema,
		// Payment hash for LN reconciliation.
		paymentHash: NonEmptyStringSchema,
		privateKey: NonEmptyStringSchema,
		walletPubkey: NonEmptyStringSchema,
		// Satoshis.
		amount: NonNegativeIntegerSchema,
		// UNIX timestamp in seconds (invoice expiry).
		expirationIn: TimestampSecSchema,
	},
	paymentLnSpark: {
		id: TableIdSchema,
		accountId: TableIdSchema,
		lnInvoice: NonEmptyStringSchema,
		// Payment hash for LN reconciliation.
		paymentHash: NonEmptyStringSchema,
		// Identifier returned by Spark invoice API.
		sparkInvoiceId: NonEmptyStringSchema,
		// Satoshis.
		amount: NonNegativeIntegerSchema,
		// UNIX timestamp in seconds (invoice expiry).
		expirationIn: TimestampSecSchema,
	},
	paymentLnNwc: {
		id: TableIdSchema,
		accountId: TableIdSchema,
		lnInvoice: NonEmptyStringSchema,
		// Payment hash for LN reconciliation.
		paymentHash: NonEmptyStringSchema,
		// Satoshis.
		amount: NonNegativeIntegerSchema,
		// UNIX timestamp in seconds (invoice expiry).
		expirationIn: TimestampSecSchema,
	},
	paymentBankTransferCZ: {
		id: TableIdSchema,
		iban: IbanSchema,
		variableSymbol: VariableSymbolSchema,
	},
	paymentCash: {
		id: TableIdSchema,
		// Cash register account where the cash settlement is recorded.
		accountId: NullableTableIdSchema,
	},
	paymentWatchingState: {
		id: TableIdSchema,
		// Epoch milliseconds when watcher marked payment as verified.
		verifiedAt: TimestampMsSchema.nullable(),
		// Verification source/type
		proveType: z.enum(["lnZap", "lnSpark", "lnNwc"]).nullable(),
		// Related transaction id created by verification process.
		transactionId: NullableTableIdSchema,
		// Epoch milliseconds when active watching was interrupted.
		stoppedAt: TimestampMsSchema.nullable(),
		// Reason for stopping active watching.
		stopReason: z.enum(PaymentWatchingStopReason).nullable(),
	},
} satisfies RawEvoluSchema;

export const createQuery = createQueryBuilder(AppSchema);

export const createAppEvolu = async (props: {
	mnemonic: Mnemonic;
	transports: ReadonlyArray<OwnerTransport>;
}) => {
	const run = createRun(createEvoluDeps());
	const evolu = getOrThrow(
		await createEvolu(AppSchema, {
			appName: AppName.orThrow(`Finito${createIdFromString(props.mnemonic)}`),
			// enableLogging: true,
			transports: props.transports,
			appOwner: createAppOwner(mnemonicToOwnerSecret(props.mnemonic)),
			indexes: (create) => {
				const foreignKeyIndexes = (
					Object.entries(AppSchema) as Array<
						[keyof typeof AppSchema, (typeof AppSchema)[keyof typeof AppSchema]]
					>
				).flatMap(([tableName, tableSchema]) =>
					Object.entries(tableSchema)
						.filter(
							([columnName, columnSchema]) =>
								columnName !== "id" &&
								(columnSchema === TableIdSchema ||
									columnSchema === NullableTableIdSchema),
						)
						.map(([columnName]) =>
							create(`${tableName}_${columnName}`)
								.on(tableName as never)
								.column(columnName as never),
						),
				);

				return [
					...foreignKeyIndexes,
					create(`posBillRate_billId_currency`)
						.on(`posBillRate`)
						.column("billId")
						.column("currency"),
					create(`reservation_tag`).on(`reservation`).column("_tag"),
					create(`reservation_startAt`).on(`reservation`).column("startAt"),
					create(`reservation_endAt`).on(`reservation`).column("endAt"),
					create(`reservationBooking_approvalStatus`)
						.on(`reservationBooking`)
						.column("approvalStatus"),
					create(`reservationBooking_serviceStatus`)
						.on(`reservationBooking`)
						.column("serviceStatus"),
					create(`openingHoursRegularSlot_settings_weekday_sortOrder`)
						.on(`openingHoursRegularSlot`)
						.column("openingHoursSettingsId")
						.column("weekday")
						.column("sortOrder"),
					create(`openingHoursExceptionDay_settings_date`)
						.on(`openingHoursExceptionDay`)
						.column("openingHoursSettingsId")
						.column("date"),
					create(`openingHoursExceptionSlot_exceptionDay_sortOrder`)
						.on(`openingHoursExceptionSlot`)
						.column("openingHoursExceptionDayId")
						.column("sortOrder"),
					create(`transaction_tag`).on(`transaction`).column("_tag"),
					create(`transaction_occurredAt`)
						.on(`transaction`)
						.column("occurredAt"),
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
					create(`paymentLnNwc_paymentHash`)
						.on(`paymentLnNwc`)
						.column("paymentHash"),
					// Partial index for actively watched payments (verifiedAt/stoppedAt are null).
					create(`paymentWatchingState_watching_by_timestamps`)
						.on(`paymentWatchingState`)
						.column("verifiedAt")
						.column("stoppedAt")
						.where("verifiedAt", "is", null)
						.where("stoppedAt", "is", null),
				];
			},
		})(run),
	);

	// (async () => {
	// 	console.log("appOwner", await evolu.appOwner, props.mnemonic);
	// })();

	// evolu.resetAppOwner();

	// (async () => {
	// 	const historyQuery = createQuery((db) =>
	// 		db.selectFrom("evolu_history").selectAll().orderBy("timestamp", "desc"),
	// 	);
	//
	// 	const history = await evolu.loadQuery(historyQuery);
	// 	console.log("history", history);
	// })();

	// evolu.subscribeError(() => {
	// 	const error = evolu.getError();
	// 	if (!error) return;
	//
	// 	alert("🚨 Evolu error occurred! Check the console.");
	// 	// eslint-disable-next-line no-console
	// 	console.error(error);
	// });

	return evolu;
};

export type EvoluSchema = typeof AppSchema;
export type Evolu = RawEvolu<EvoluSchema>;
export type EvoluSchemaType = {
	[key in keyof EvoluSchema]: {
		[key2 in keyof EvoluSchema[key]]: StandardSchemaV1.InferOutput<
			// @ts-expect-error
			EvoluSchema[key][key2]
		>;
	};
};
