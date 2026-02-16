import type { Id } from "@evolu/common";
import type { ReservationVm, TableVm } from "./types";

export type ReservationIssueSummary = {
	count: number;
	ids: Set<Id>;
	orderedIds: Id[];
};

export const getReservationCollisions = (
	reservations: ReadonlyArray<ReservationVm>,
): ReservationIssueSummary => {
	const byTable = new Map<Id, ReservationVm[]>();
	for (const reservation of reservations) {
		if (
			reservation._tag === "reservationBooking" &&
			reservation.approvalStatus === "rejected"
		) {
			continue;
		}
		if (!reservation.tableId) continue;
		const list = byTable.get(reservation.tableId) ?? [];
		list.push(reservation);
		byTable.set(reservation.tableId, list);
	}

	const collisionIds = new Set<Id>();
	const orderedCollisionIds: Id[] = [];
	let count = 0;

	for (const tableReservations of byTable.values()) {
		const sorted = [...tableReservations].sort((a, b) => a.startAt - b.startAt);
		for (let i = 1; i < sorted.length; i += 1) {
			const previous = sorted[i - 1];
			const current = sorted[i];
			if (current.startAt < previous.endAt) {
				if (!collisionIds.has(previous.id)) {
					collisionIds.add(previous.id);
					orderedCollisionIds.push(previous.id);
				}
				if (!collisionIds.has(current.id)) {
					collisionIds.add(current.id);
					orderedCollisionIds.push(current.id);
				}
				count += 1;
			}
		}
	}

	return {
		count,
		ids: collisionIds,
		orderedIds: orderedCollisionIds,
	};
};

export const getReservationCapacityViolations = (
	reservations: ReadonlyArray<ReservationVm>,
	tables: ReadonlyArray<TableVm>,
): ReservationIssueSummary => {
	const tableCapacityById = new Map(
		tables.map((table) => [table.id, table.numberOfSeats] as const),
	);
	const ids = new Set<Id>();
	const orderedIds: Id[] = [];

	for (const reservation of reservations) {
		if (reservation._tag !== "reservationBooking") continue;
		if (reservation.approvalStatus === "rejected") continue;
		if (reservation.tableId === null) continue;
		const tableCapacity = tableCapacityById.get(reservation.tableId);
		if (tableCapacity === undefined) continue;
		if (reservation.numberOfPeople <= tableCapacity) continue;
		if (ids.has(reservation.id)) continue;
		ids.add(reservation.id);
		orderedIds.push(reservation.id);
	}

	return {
		count: orderedIds.length,
		ids,
		orderedIds,
	};
};

export const getApprovedReservationWithoutTableViolations = (
	reservations: ReadonlyArray<ReservationVm>,
): ReservationIssueSummary => {
	const ids = new Set<Id>();
	const orderedIds: Id[] = [];

	for (const reservation of reservations) {
		if (reservation._tag !== "reservationBooking") continue;
		if (reservation.approvalStatus !== "approved") continue;
		if (reservation.tableId !== null) continue;
		if (ids.has(reservation.id)) continue;
		ids.add(reservation.id);
		orderedIds.push(reservation.id);
	}

	return {
		count: orderedIds.length,
		ids,
		orderedIds,
	};
};
