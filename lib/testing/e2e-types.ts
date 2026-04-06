import type { Currency } from "@/lib/shared/types";

export type CatalogSeedScenario =
	| {
			name: "empty-catalog";
	  }
	| {
			name: "single-item";
			item?: {
				label?: string;
				price?: number;
				currency?: Currency;
			};
	  };

export type CatalogSeedResult = {
	mnemonic: string;
	deviceId: string;
	item?: {
		id: string;
		label: string;
	};
};

export type FinitoE2EHarness = {
	bootstrap: () => Promise<{
		deviceId: string;
		mnemonic: string;
	}>;
	seedCatalogScenario: (
		scenario: CatalogSeedScenario,
	) => Promise<CatalogSeedResult>;
};
