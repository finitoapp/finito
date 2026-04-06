import { createIdFromString, type Id, type Mnemonic } from "@evolu/common";
import {
	activateOrCreateAccountWithMnemonic,
	createAccountMnemonic,
} from "@/atoms/account";
import { createAppEvolu } from "@/lib/evolu";
import type { DeviceEvolu } from "@/lib/evolu/device";
import { PaymentMethod } from "@/lib/evolu/model/payment";
import {
	Currency,
	FiatCurrency,
	Integer,
	NonEmptyString255,
	ProductCodeType,
	Timezone,
} from "@/lib/shared/types";
import type { E2EWorkerContext } from "@/lib/testing/e2e-types";

export const createE2eDevice = (context: E2EWorkerContext) => ({
	id: createIdFromString(context.deviceKey) as Id,
	name: NonEmptyString255(`E2E Browser ${context.workerId}`),
	deviceType: "desktop",
	deviceVendor: "Playwright",
	browserName: "Chromium",
	osName: "Linux",
});

export const persistE2eBrowserState = (deviceId: Id) => {
	window.localStorage.setItem("finito:language", "en");
	window.localStorage.setItem("finito.deviceId", deviceId);
};

const deleteIndexedDb = async (name: string) =>
	await new Promise<void>((resolve) => {
		const request = window.indexedDB.deleteDatabase(name);
		request.onsuccess = () => resolve();
		request.onerror = () => resolve();
		request.onblocked = () => resolve();
	});

export const resetE2eBrowserState = async () => {
	window.localStorage.clear();
	window.sessionStorage.clear();

	if ("databases" in window.indexedDB) {
		const databases = await window.indexedDB.databases();
		for (const database of databases) {
			if (database.name) {
				await deleteIndexedDb(database.name);
			}
		}
	}

	if ("caches" in window) {
		const cacheKeys = await window.caches.keys();
		await Promise.all(cacheKeys.map((key) => window.caches.delete(key)));
	}
};

export const ensureDeviceRow = async (
	deviceEvolu: DeviceEvolu,
	device: ReturnType<typeof createE2eDevice>,
) => {
	await new Promise<void>((resolve) => {
		deviceEvolu.upsert("device", device, {
			onComplete: resolve,
		});
	});
};

export const bootstrapE2eAccount = async (
	deviceEvolu: DeviceEvolu,
	context: E2EWorkerContext,
	mnemonic: Mnemonic = createAccountMnemonic(),
) => {
	const e2eDevice = createE2eDevice(context);
	persistE2eBrowserState(e2eDevice.id);
	await activateOrCreateAccountWithMnemonic(deviceEvolu, mnemonic, {
		accountName: "E2E Admin",
	});
	await ensureDeviceRow(deviceEvolu, e2eDevice);

	return {
		mnemonic,
		device: e2eDevice,
	};
};

export const createE2eAppEvolu = async (mnemonic: Mnemonic) =>
	await createAppEvolu({
		mnemonic,
		transports: [],
	});

export const ensureBillingSettings = async (
	evolu: Awaited<ReturnType<typeof createAppEvolu>>,
) => {
	await new Promise<void>((resolve) => {
		evolu.upsert(
			"billingSettings",
			{
				id: createIdFromString(""),
				ownContactId: null,
				defaultCurrency: FiatCurrency.CZK,
				defaultTimezone: Timezone["Europe/Prague"],
				defaultPaymentMethodBankAccountKey: null,
				defaultPaymentMethod: PaymentMethod.Cash,
				defaultBankTransferCzKey: null,
				defaultLnZapKey: null,
				defaultLnSparkKey: null,
			},
			{
				onComplete: resolve,
			},
		);
	});
};

export const insertCatalogItem = async (
	evolu: Awaited<ReturnType<typeof createAppEvolu>>,
	input: {
		deviceId: Id;
		label: string;
		price?: number;
		currency?: Currency;
		categoryId?: Id | null;
	},
) => {
	const label = NonEmptyString255(input.label);
	const price = Integer(input.price ?? 15_900);
	const currency = input.currency ?? Currency.CZK;

	const itemId = await new Promise<Id>((resolve) => {
		const { id } = evolu.insert(
			"catalogItem",
			{
				deviceId: input.deviceId,
				categoryId: input.categoryId ?? null,
				label,
				price,
				currency,
				unitOfMeasure: null,
				internalCode: null,
				productCodeType: ProductCodeType.EAN,
				productCodeValue: null,
			},
			{
				onComplete: () => {
					resolve(id);
				},
			},
		);
	});

	return {
		id: itemId,
		label,
	};
};

export const insertCategory = async (
	evolu: Awaited<ReturnType<typeof createAppEvolu>>,
	input: {
		deviceId: Id;
		name: string;
	},
) => {
	const name = NonEmptyString255(input.name);

	const categoryId = await new Promise<Id>((resolve) => {
		const { id } = evolu.insert(
			"category",
			{
				deviceId: input.deviceId,
				name,
			},
			{
				onComplete: () => {
					resolve(id);
				},
			},
		);
	});

	return {
		id: categoryId,
		name,
	};
};
