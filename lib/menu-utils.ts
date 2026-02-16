import { MenuStatus } from "@/storages/menu-storage";

export const isMenuVisibleForPublic = (params: {
	status: string | null;
	publishedAt: number | null;
	now?: number;
}) => {
	const now = params.now ?? Date.now();
	return (
		params.status === MenuStatus.Published &&
		(params.publishedAt === null || params.publishedAt <= now)
	);
};

const pad2 = (value: number) => value.toString().padStart(2, "0");

export const toDatetimeLocalInputValue = (value: number | null | undefined) => {
	if (value === null || value === undefined) return "";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "";

	const year = date.getFullYear();
	const month = pad2(date.getMonth() + 1);
	const day = pad2(date.getDate());
	const hours = pad2(date.getHours());
	const minutes = pad2(date.getMinutes());
	return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export const fromDatetimeLocalInputValue = (
	value: string | null | undefined,
) => {
	if (!value) return null;
	const parsed = new Date(value).getTime();
	return Number.isNaN(parsed) ? null : parsed;
};
