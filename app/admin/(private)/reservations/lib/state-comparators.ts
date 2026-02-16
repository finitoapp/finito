import type {
	DayRange,
	ReservationVm,
	TableVm,
} from "@/app/admin/(private)/reservations/lib/types";

const areArraysEqualBy = <T>(
	left: readonly T[],
	right: readonly T[],
	isEqual: (a: T, b: T) => boolean,
): boolean => {
	if (left === right) return true;
	if (left.length !== right.length) return false;
	for (let index = 0; index < left.length; index += 1) {
		const leftValue = left[index];
		const rightValue = right[index];
		if (leftValue === undefined || rightValue === undefined) return false;
		if (!isEqual(leftValue, rightValue)) return false;
	}
	return true;
};

export const areDayRangesEqual = (left: DayRange, right: DayRange) =>
	left.dayStartMs === right.dayStartMs &&
	left.dayEndMs === right.dayEndMs &&
	left.openMs === right.openMs &&
	left.closeMs === right.closeMs;

export const areTablesEqual = (
	left: readonly TableVm[],
	right: readonly TableVm[],
) =>
	areArraysEqualBy(
		left,
		right,
		(a, b) =>
			a.id === b.id &&
			a.label === b.label &&
			a.numberOfSeats === b.numberOfSeats,
	);

export const areReservationsEqual = (
	left: readonly ReservationVm[],
	right: readonly ReservationVm[],
) =>
	areArraysEqualBy(
		left,
		right,
		(a, b) =>
			a.id === b.id &&
			a._tag === b._tag &&
			a.tableId === b.tableId &&
			a.note === b.note &&
			a.startAt === b.startAt &&
			a.endAt === b.endAt &&
			(a._tag === "reservationBooking" && b._tag === "reservationBooking"
				? a.name === b.name &&
					a.phone === b.phone &&
					a.email === b.email &&
					a.numberOfPeople === b.numberOfPeople &&
					a.approvalStatus === b.approvalStatus &&
					a.serviceStatus === b.serviceStatus &&
					a.statusReason === b.statusReason &&
					a.source === b.source
				: a._tag === "reservationBlock" && b._tag === "reservationBlock"
					? a.label === b.label
					: false),
	);

type Family = {
	setShouldRemove: (fn: (createdAt: number) => boolean) => void;
};

export const setFamiliesTtl = (
	ttlMs: number,
	...families: readonly Family[]
) => {
	const shouldRemove = (createdAt: number) => Date.now() - createdAt > ttlMs;
	for (const family of families) {
		family.setShouldRemove(shouldRemove);
	}
};
