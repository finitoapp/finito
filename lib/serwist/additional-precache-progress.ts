export const ADDITIONAL_PRECACHE_PROGRESS_MESSAGE =
	"finito.additionalPrecacheProgress";
export const GET_ADDITIONAL_PRECACHE_PROGRESS_MESSAGE =
	"finito.getAdditionalPrecacheProgress";

export type AdditionalPrecacheProgressStatus =
	| "idle"
	| "running"
	| "complete"
	| "error";

export interface AdditionalPrecacheProgressPayload {
	completed: number;
	status: AdditionalPrecacheProgressStatus;
	total: number;
}

export interface AdditionalPrecacheProgressMessage {
	payload: AdditionalPrecacheProgressPayload;
	type: typeof ADDITIONAL_PRECACHE_PROGRESS_MESSAGE;
}

export interface GetAdditionalPrecacheProgressMessage {
	type: typeof GET_ADDITIONAL_PRECACHE_PROGRESS_MESSAGE;
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

export function isAdditionalPrecacheProgressMessage(
	value: unknown,
): value is AdditionalPrecacheProgressMessage {
	if (!isObject(value)) return false;
	if (value.type !== ADDITIONAL_PRECACHE_PROGRESS_MESSAGE) return false;

	const { payload } = value;
	if (!isObject(payload)) return false;

	return (
		(payload.status === "idle" ||
			payload.status === "running" ||
			payload.status === "complete" ||
			payload.status === "error") &&
		typeof payload.completed === "number" &&
		typeof payload.total === "number"
	);
}

export function isGetAdditionalPrecacheProgressMessage(
	value: unknown,
): value is GetAdditionalPrecacheProgressMessage {
	return (
		isObject(value) && value.type === GET_ADDITIONAL_PRECACHE_PROGRESS_MESSAGE
	);
}
