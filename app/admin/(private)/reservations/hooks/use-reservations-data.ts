"use client";

import { createIdFromString, type Id, sqliteTrue } from "@evolu/common";
import { useMemo } from "react";
import {
	CALENDAR_SETTINGS,
	createDayRange,
} from "@/app/admin/(private)/reservations/lib/calendar-math";
import type {
	ReservationApprovalStatus,
	ReservationServiceStatus,
	ReservationSource,
	ReservationTag,
	ReservationVm,
	TableVm,
} from "@/app/admin/(private)/reservations/lib/types";
import { useCreateQuery } from "@/hooks/use-create-query";
import { useEvoluQuery } from "@/hooks/use-evolu-query";

export const useReservationsData = (params: { selectedDay: Date }) => {
	const billingSettingsId = createIdFromString("");
	const billingSettingsQuery = useCreateQuery(
		(db) =>
			db
				.selectFrom("billingSettings")
				.select(["billingSettings.defaultTimezone as defaultTimezone"] as const)
				.where("billingSettings.isDeleted", "is not", sqliteTrue)
				.where("billingSettings.id", "=", billingSettingsId),
		[billingSettingsId],
	);
	const { data: billingSettingsRows } = useEvoluQuery(billingSettingsQuery);
	const timezone =
		(billingSettingsRows?.[0]?.defaultTimezone as string | null | undefined) ??
		CALENDAR_SETTINGS.defaultTimezone;

	const dayRange = useMemo(
		() => createDayRange(params.selectedDay, timezone),
		[params.selectedDay, timezone],
	);

	const tablesQuery = useCreateQuery(
		(db) =>
			db
				.selectFrom("table")
				.select([
					"table.id as id",
					"table.label as label",
					"table.numberOfSeats as numberOfSeats",
				] as const)
				.where("table.isDeleted", "is not", sqliteTrue)
				.orderBy("table.label", "asc"),
		[],
	);
	const { data: tableRows } = useEvoluQuery(tablesQuery);
	const tables = useMemo<ReadonlyArray<TableVm>>(
		() =>
			(tableRows ?? []).flatMap((table) =>
				table.id === null ||
				table.label === null ||
				table.numberOfSeats === null
					? []
					: [
							{
								id: table.id as Id,
								label: table.label,
								numberOfSeats: table.numberOfSeats,
							},
						],
			),
		[tableRows],
	);

	const reservationsQuery = useCreateQuery(
		(db) =>
			db
				.selectFrom("reservation")
				.leftJoin(
					"reservationBooking",
					"reservationBooking.id",
					"reservation.id",
				)
				.leftJoin("reservationBlock", "reservationBlock.id", "reservation.id")
				.select([
					"reservation.id as id",
					"reservation._tag as _tag",
					"reservation.tableId as tableId",
					"reservation.note as note",
					"reservation.startAt as startAt",
					"reservation.endAt as endAt",
					"reservationBooking.name as bookingName",
					"reservationBooking.phone as bookingPhone",
					"reservationBooking.email as bookingEmail",
					"reservationBooking.numberOfPeople as bookingNumberOfPeople",
					"reservationBooking.approvalStatus as bookingApprovalStatus",
					"reservationBooking.serviceStatus as bookingServiceStatus",
					"reservationBooking.statusReason as bookingStatusReason",
					"reservationBooking.source as bookingSource",
					"reservationBlock.label as blockLabel",
				] as const)
				.where("reservation.isDeleted", "is not", sqliteTrue)
				.where("reservation.startAt", "<", dayRange.dayEndMs as never)
				.where("reservation.endAt", ">", dayRange.dayStartMs as never)
				.orderBy("reservation.startAt", "asc"),
		[dayRange.dayStartMs, dayRange.dayEndMs],
	);
	const { data: reservationRows } = useEvoluQuery(reservationsQuery);
	const reservations = useMemo<ReadonlyArray<ReservationVm>>(() => {
		const mapped: ReservationVm[] = [];
		for (const row of reservationRows ?? []) {
			if (
				row.id === null ||
				row._tag === null ||
				row.startAt === null ||
				row.endAt === null
			) {
				continue;
			}

			const id = row.id as Id;
			const tableId = (row.tableId ?? null) as Id | null;
			const _tag = row._tag as ReservationTag;
			const note = row.note ?? null;
			const startAt = row.startAt;
			const endAt = row.endAt;

			if (_tag === "reservationBooking") {
				if (row.bookingName === null || row.bookingNumberOfPeople === null) {
					continue;
				}
				const approvalStatus =
					(row.bookingApprovalStatus as ReservationApprovalStatus | null) ??
					"pending";
				const serviceStatus =
					(row.bookingServiceStatus as ReservationServiceStatus | null) ??
					"upcoming";
				mapped.push({
					id,
					_tag,
					tableId,
					note,
					startAt,
					endAt,
					name: row.bookingName,
					phone: row.bookingPhone ?? null,
					email: row.bookingEmail ?? null,
					numberOfPeople: row.bookingNumberOfPeople,
					approvalStatus,
					serviceStatus,
					statusReason: row.bookingStatusReason ?? null,
					source: (row.bookingSource as ReservationSource | null) ?? null,
				});
				continue;
			}

			if (_tag === "reservationBlock") {
				if (row.blockLabel === null) continue;
				mapped.push({
					id,
					_tag,
					tableId,
					note,
					startAt,
					endAt,
					label: row.blockLabel,
				});
			}
		}
		return mapped;
	}, [reservationRows]);

	return {
		timezone,
		dayRange,
		tables,
		reservations,
	};
};
