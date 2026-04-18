import type { ConsoleDep } from "@evolu/common";
import type {
	CreateDbWorker,
	DbWorkerInit,
	EvoluDeps,
	SharedWorkerInput,
} from "@evolu/common/local-first";
import { createEvoluDeps as createCommonEvoluDeps } from "@evolu/common/local-first";
import {
	createMessageChannel,
	createSharedWorker,
	createWorker,
} from "@evolu/web";

const EVOLU_WORKER_BASE_PATH = "/evolu";

const reloadApp = (url?: string) => {
	if (typeof document === "undefined") {
		return;
	}

	location.replace(url ?? "/");
};

export const createFinitoEvoluDeps = (
	deps: Partial<ConsoleDep> = {},
): EvoluDeps => {
	const createDbWorker: CreateDbWorker = () =>
		createWorker<DbWorkerInit, never>(
			new Worker(`${EVOLU_WORKER_BASE_PATH}/Db.worker.js`, {
				type: "module",
			}),
		);

	const sharedWorker = createSharedWorker<SharedWorkerInput>(
		new SharedWorker(`${EVOLU_WORKER_BASE_PATH}/Shared.worker.js`, {
			type: "module",
		}),
	);

	return createCommonEvoluDeps({
		...deps,
		createDbWorker,
		createMessageChannel,
		reloadApp,
		sharedWorker,
	});
};
