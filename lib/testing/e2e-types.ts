import type { Currency } from "@/lib/shared/types";

export type CatalogScenarioInput =
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

export type E2EScenarioName = "catalog";

export type E2EScenarioInputMap = {
	catalog: CatalogScenarioInput;
};

export type CatalogScenarioResult = {
	mnemonic: string;
	deviceId: string;
	item?: {
		id: string;
		label: string;
	};
};

export type E2EScenarioResultMap = {
	catalog: CatalogScenarioResult;
};

export type E2EWorkerContext = {
	workerId: string;
	deviceKey: string;
};

export type E2EScenarioContext = E2EWorkerContext & {
	testId: string;
};

export type FinitoE2EHarness = {
	resetBrowserState: () => Promise<void>;
	bootstrap: (context: E2EWorkerContext) => Promise<{
		deviceId: string;
		mnemonic: string;
	}>;
	runScenario: <TName extends E2EScenarioName>(
		name: TName,
		input: E2EScenarioInputMap[TName],
		context: E2EScenarioContext,
	) => Promise<E2EScenarioResultMap[TName]>;
};
