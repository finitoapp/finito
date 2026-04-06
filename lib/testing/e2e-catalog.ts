import type { DeviceEvolu } from "@/lib/evolu/device";
import {
	bootstrapE2eAccount,
	createE2eAppEvolu,
	ensureBillingSettings,
	ensureDeviceRow,
	insertCatalogItem,
	resetE2eBrowserState,
} from "@/lib/testing/e2e-primitives";
import type {
	CatalogScenarioInput,
	CatalogScenarioResult,
	E2EWorkerContext,
} from "@/lib/testing/e2e-types";

export { bootstrapE2eAccount, resetE2eBrowserState };

export const runCatalogScenario = async (
	deviceEvolu: DeviceEvolu,
	scenario: CatalogScenarioInput,
	context: E2EWorkerContext,
): Promise<CatalogScenarioResult> => {
	const { mnemonic, device } = await bootstrapE2eAccount(deviceEvolu, context);
	const evolu = await createE2eAppEvolu(mnemonic);

	await ensureDeviceRow(deviceEvolu, device);
	await ensureBillingSettings(evolu);

	if (scenario.name === "single-item") {
		const item = await insertCatalogItem(evolu, {
			deviceId: device.id,
			label: scenario.item?.label ?? "E2E Seeded Catalog Item",
			price: scenario.item?.price,
			currency: scenario.item?.currency,
		});

		return {
			mnemonic,
			deviceId: device.id,
			item,
		};
	}

	return {
		mnemonic,
		deviceId: device.id,
	};
};
