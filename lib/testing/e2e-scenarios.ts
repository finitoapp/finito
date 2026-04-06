import type { DeviceEvolu } from "@/lib/evolu/device";
import { runCatalogScenario } from "@/lib/testing/e2e-catalog";
import type {
	CatalogScenarioInput,
	CatalogScenarioResult,
	E2EScenarioInputMap,
	E2EScenarioName,
	E2EScenarioResultMap,
} from "@/lib/testing/e2e-types";

type ScenarioRunner<TInput, TResult> = (
	deviceEvolu: DeviceEvolu,
	input: TInput,
) => Promise<TResult>;

const scenarioRegistry: {
	[K in E2EScenarioName]: ScenarioRunner<
		E2EScenarioInputMap[K],
		E2EScenarioResultMap[K]
	>;
} = {
	catalog: runCatalogScenario as ScenarioRunner<
		CatalogScenarioInput,
		CatalogScenarioResult
	>,
};

export const runE2EScenario = <TName extends E2EScenarioName>(
	deviceEvolu: DeviceEvolu,
	name: TName,
	input: E2EScenarioInputMap[TName],
): Promise<E2EScenarioResultMap[TName]> => {
	return scenarioRegistry[name](deviceEvolu, input);
};
