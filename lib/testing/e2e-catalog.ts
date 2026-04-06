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
import type {
	CatalogScenarioInput,
	CatalogScenarioResult,
} from "@/lib/testing/e2e-types";

const e2eDevice = {
	id: createIdFromString("e2e-device") as Id,
	name: NonEmptyString255("E2E Browser"),
	deviceType: "desktop",
	deviceVendor: "Playwright",
	browserName: "Chromium",
	osName: "Linux",
};

const persistE2eBrowserState = () => {
	window.localStorage.setItem("finito:language", "en");
	window.localStorage.setItem("finito.deviceId", e2eDevice.id);
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

const ensureDeviceRow = async (deviceEvolu: DeviceEvolu) => {
	await new Promise<void>((resolve) => {
		deviceEvolu.upsert("device", e2eDevice, {
			onComplete: resolve,
		});
	});
};

export const bootstrapE2eAccount = async (
	deviceEvolu: DeviceEvolu,
	mnemonic: Mnemonic = createAccountMnemonic(),
) => {
	persistE2eBrowserState();
	await activateOrCreateAccountWithMnemonic(deviceEvolu, mnemonic, {
		accountName: "E2E Admin",
	});
	await ensureDeviceRow(deviceEvolu);

	return {
		mnemonic,
		device: e2eDevice,
	};
};

export const runCatalogScenario = async (
	deviceEvolu: DeviceEvolu,
	scenario: CatalogScenarioInput,
): Promise<CatalogScenarioResult> => {
	const { mnemonic, device } = await bootstrapE2eAccount(deviceEvolu);
	const evolu = await createAppEvolu({
		mnemonic,
		transports: [],
	});

	await new Promise<void>((resolve) => {
		evolu.upsert("device", device, {
			onComplete: resolve,
		});
	});

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

	if (scenario.name === "single-item") {
		const label = NonEmptyString255(
			scenario.item?.label ?? "E2E Seeded Catalog Item",
		);
		const price = Integer(scenario.item?.price ?? 15_900);
		const currency = scenario.item?.currency ?? Currency.CZK;

		const itemId = await new Promise<Id>((resolve) => {
			const { id } = evolu.insert(
				"catalogItem",
				{
					deviceId: device.id,
					categoryId: null,
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
			mnemonic,
			deviceId: device.id,
			item: {
				id: itemId,
				label,
			},
		};
	}

	return {
		mnemonic,
		deviceId: device.id,
	};
};
