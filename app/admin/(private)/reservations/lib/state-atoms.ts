"use client";

import type { Id } from "@evolu/common";
import { atom } from "jotai";
import { atomFamily } from "jotai/utils";
import {
	CALENDAR_SETTINGS,
	createDayRange,
	getTimelineMetrics,
} from "@/app/admin/(private)/reservations/lib/calendar-math";
import {
	createDraftFromCreate,
	createDraftFromReservation,
} from "@/app/admin/(private)/reservations/lib/reservation-draft";
import {
	getApprovedReservationWithoutTableViolations,
	getReservationCapacityViolations,
	getReservationCollisions,
} from "@/app/admin/(private)/reservations/lib/reservation-rules";
import {
	areDayRangesEqual,
	areReservationsEqual,
	areTablesEqual,
	setFamiliesTtl,
} from "@/app/admin/(private)/reservations/lib/state-comparators";
import type {
	DayRange,
	DraftReservation,
	LongPressPreview,
	PreviewReservation,
	ReservationBookingVm,
	ReservationTag,
	ReservationVm,
	SlotSelectionPreview,
	TableVm,
} from "@/app/admin/(private)/reservations/lib/types";

export const createReservationStateAtoms = () => {
	const ATOM_FAMILY_TTL_MS = 5 * 60 * 1000;
	const selectedDayAtom = atom(new Date());
	const minSeatsFilterAtom = atom("");
	const zoomAtom = atom(0.6);
	const verticalZoomAtom = atom(1);
	const previewReservationAtom = atom<PreviewReservation | null>(null);
	const slotSelectionPreviewAtom = atom<SlotSelectionPreview | null>(null);
	const longPressPreviewAtom = atom<LongPressPreview | null>(null);
	const selectedReservationIdAtom = atom<Id | null>(null);
	const highlightedCollisionIdsAtom = atom<readonly Id[]>([]);
	const highlightedCapacityIdsAtom = atom<readonly Id[]>([]);
	const dialogOpenAtom = atom(false);
	const tableDialogOpenAtom = atom(false);
	const draftAtom = atom<DraftReservation | null>(null);
	const editingReservationIdAtom = atom<Id | null>(null);
	const focusReservationRequestAtom = atom<Id | null>(null);
	const timezoneAtom = atom<string>(CALENDAR_SETTINGS.defaultTimezone);
	const dayRangeAtom = atom<DayRange>(
		createDayRange(new Date(), CALENDAR_SETTINGS.defaultTimezone),
	);
	const tablesAtom = atom<readonly TableVm[]>([]);
	const reservationsAtom = atom<readonly ReservationVm[]>([]);

	const filteredTablesAtom = atom((get) => {
		const tables = get(tablesAtom);
		const minSeatsFilter = get(minSeatsFilterAtom);
		const parsedMin = Number(minSeatsFilter);
		const minSeats =
			minSeatsFilter.trim() === "" || Number.isNaN(parsedMin)
				? null
				: Math.max(0, Math.floor(parsedMin));

		return tables.filter((table) => {
			if (minSeats !== null && table.numberOfSeats < minSeats) {
				return false;
			}
			return true;
		});
	});

	const reservationsForRenderAtom = atom((get) => {
		const reservations = get(reservationsAtom);
		const previewReservation = get(previewReservationAtom);

		if (previewReservation === null) {
			return reservations;
		}

		return reservations.map((reservation) => {
			if (reservation.id !== previewReservation.id) {
				return reservation;
			}
			return {
				...reservation,
				tableId: previewReservation.tableId,
				startAt: previewReservation.startAt,
				endAt: previewReservation.endAt,
			};
		});
	});

	const unassignedReservationsAtom = atom((get) =>
		get(reservationsForRenderAtom)
			.filter((reservation) => reservation.tableId === null)
			.slice()
			.sort((a, b) => a.startAt - b.startAt),
	);
	const bookingReservationsAtom = atom<readonly ReservationBookingVm[]>((get) =>
		get(reservationsForRenderAtom).flatMap((reservation) =>
			reservation._tag === "reservationBooking" ? [reservation] : [],
		),
	);
	const pendingBookingReservationsAtom = atom((get) =>
		get(bookingReservationsAtom)
			.filter((reservation) => reservation.approvalStatus === "pending")
			.slice()
			.sort((a, b) => a.startAt - b.startAt),
	);
	const approvedBookingWithoutTableAtom = atom((get) =>
		get(bookingReservationsAtom)
			.filter(
				(reservation) =>
					reservation.approvalStatus === "approved" &&
					reservation.tableId === null,
			)
			.slice()
			.sort((a, b) => a.startAt - b.startAt),
	);
	const upcomingOperationalBookingReservationsAtom = atom((get) =>
		get(bookingReservationsAtom)
			.filter(
				(reservation) =>
					reservation.approvalStatus === "approved" &&
					reservation.serviceStatus === "upcoming" &&
					reservation.tableId !== null,
			)
			.slice()
			.sort((a, b) => a.startAt - b.startAt),
	);
	const seatedOperationalBookingReservationsAtom = atom((get) =>
		get(bookingReservationsAtom)
			.filter(
				(reservation) =>
					reservation.approvalStatus === "approved" &&
					reservation.serviceStatus === "seated" &&
					reservation.tableId !== null,
			)
			.slice()
			.sort((a, b) => a.startAt - b.startAt),
	);
	const reservationsByIdAtom = atom((get) => {
		const map = new Map<Id, ReservationVm>();
		for (const reservation of get(reservationsForRenderAtom)) {
			map.set(reservation.id, reservation);
		}
		return map;
	});
	const tableLabelByIdAtom = atom(
		(get) =>
			new Map(get(tablesAtom).map((table) => [table.id, table.label] as const)),
	);
	const rowReservationIdsAtomFamily = atomFamily((tableId: Id) =>
		atom((get) => {
			const ids = get(reservationsForRenderAtom)
				.filter((reservation) => reservation.tableId === tableId)
				.slice()
				.sort((a, b) => a.startAt - b.startAt)
				.map((reservation) => reservation.id);
			return ids;
		}),
	);
	const reservationByIdAtomFamily = atomFamily((reservationId: Id) =>
		atom((get) => get(reservationsByIdAtom).get(reservationId) ?? null),
	);
	const slotSelectionPreviewForTableAtomFamily = atomFamily((tableId: Id) =>
		atom((get) => {
			const preview = get(slotSelectionPreviewAtom);
			if (preview === null || preview.tableId !== tableId) return null;
			return preview;
		}),
	);
	const longPressPreviewForTableAtomFamily = atomFamily((tableId: Id) =>
		atom((get) => {
			const preview = get(longPressPreviewAtom);
			if (preview === null || preview.tableId !== tableId) return null;
			return preview;
		}),
	);

	const timelineMetricsAtom = atom((get) => getTimelineMetrics(get(zoomAtom)));
	const collisionsAtom = atom((get) =>
		getReservationCollisions(get(reservationsAtom)),
	);
	const capacityViolationsAtom = atom((get) =>
		getReservationCapacityViolations(get(reservationsAtom), get(tablesAtom)),
	);
	const approvedWithoutTableViolationsAtom = atom((get) =>
		getApprovedReservationWithoutTableViolations(get(reservationsAtom)),
	);
	const isLongPressPreviewVisibleAtom = atom(
		(get) => get(longPressPreviewAtom) !== null,
	);
	const syncDataAtom = atom(
		null,
		(
			get,
			set,
			value: {
				timezone: string;
				dayRange: DayRange;
				tables: readonly TableVm[];
				reservations: readonly ReservationVm[];
			},
		) => {
			if (get(timezoneAtom) !== value.timezone) {
				set(timezoneAtom, value.timezone);
			}
			if (!areDayRangesEqual(get(dayRangeAtom), value.dayRange)) {
				set(dayRangeAtom, value.dayRange);
			}
			if (!areTablesEqual(get(tablesAtom), value.tables)) {
				set(tablesAtom, value.tables);
			}
			if (!areReservationsEqual(get(reservationsAtom), value.reservations)) {
				set(reservationsAtom, value.reservations);
			}
		},
	);
	const tableOptionsAtom = atom((get) =>
		get(tablesAtom).map((table) => ({
			id: table.id,
			label: table.label,
		})),
	);
	const isSelectedReservationAtomFamily = atomFamily((reservationId: Id) =>
		atom((get) => get(selectedReservationIdAtom) === reservationId),
	);
	const isCollisionReservationAtomFamily = atomFamily((reservationId: Id) =>
		atom((get) => get(collisionsAtom).ids.has(reservationId)),
	);
	const isCapacityViolationReservationAtomFamily = atomFamily(
		(reservationId: Id) =>
			atom((get) => get(capacityViolationsAtom).ids.has(reservationId)),
	);
	const isHighlightedCollisionReservationAtomFamily = atomFamily(
		(reservationId: Id) =>
			atom((get) => get(highlightedCollisionIdsAtom).includes(reservationId)),
	);
	const isHighlightedCapacityReservationAtomFamily = atomFamily(
		(reservationId: Id) =>
			atom((get) => get(highlightedCapacityIdsAtom).includes(reservationId)),
	);
	setFamiliesTtl(
		ATOM_FAMILY_TTL_MS,
		rowReservationIdsAtomFamily,
		reservationByIdAtomFamily,
		slotSelectionPreviewForTableAtomFamily,
		longPressPreviewForTableAtomFamily,
		isSelectedReservationAtomFamily,
		isCollisionReservationAtomFamily,
		isCapacityViolationReservationAtomFamily,
		isHighlightedCollisionReservationAtomFamily,
		isHighlightedCapacityReservationAtomFamily,
	);

	const openCreateDialogAtom = atom(
		null,
		(
			get,
			set,
			params: {
				_tag?: ReservationTag;
				tableId: Id | null;
				startAt: number;
				durationMinutes?: number;
			},
		) => {
			const timezone = get(timezoneAtom);
			set(editingReservationIdAtom, null);
			set(
				draftAtom,
				createDraftFromCreate({
					timezone,
					_tag: params._tag,
					tableId: params.tableId,
					startAt: params.startAt,
					durationMinutes: params.durationMinutes,
				}),
			);
			set(dialogOpenAtom, true);
		},
	);

	const openEditDialogAtom = atom(
		null,
		(get, set, reservation: ReservationVm) => {
			const timezone = get(timezoneAtom);
			set(editingReservationIdAtom, reservation.id);
			set(draftAtom, createDraftFromReservation({ timezone, reservation }));
			set(dialogOpenAtom, true);
		},
	);
	const openTableDialogAtom = atom(null, (_get, set) => {
		set(tableDialogOpenAtom, true);
	});

	return {
		selectedDayAtom,
		minSeatsFilterAtom,
		zoomAtom,
		verticalZoomAtom,
		previewReservationAtom,
		slotSelectionPreviewAtom,
		longPressPreviewAtom,
		selectedReservationIdAtom,
		highlightedCollisionIdsAtom,
		highlightedCapacityIdsAtom,
		dialogOpenAtom,
		tableDialogOpenAtom,
		draftAtom,
		editingReservationIdAtom,
		focusReservationRequestAtom,
		timezoneAtom,
		dayRangeAtom,
		tablesAtom,
		reservationsAtom,
		filteredTablesAtom,
		reservationsForRenderAtom,
		unassignedReservationsAtom,
		bookingReservationsAtom,
		pendingBookingReservationsAtom,
		approvedBookingWithoutTableAtom,
		upcomingOperationalBookingReservationsAtom,
		seatedOperationalBookingReservationsAtom,
		rowReservationIdsAtomFamily,
		reservationByIdAtomFamily,
		slotSelectionPreviewForTableAtomFamily,
		longPressPreviewForTableAtomFamily,
		timelineMetricsAtom,
		collisionsAtom,
		capacityViolationsAtom,
		approvedWithoutTableViolationsAtom,
		isLongPressPreviewVisibleAtom,
		syncDataAtom,
		tableLabelByIdAtom,
		tableOptionsAtom,
		isSelectedReservationAtomFamily,
		isCollisionReservationAtomFamily,
		isCapacityViolationReservationAtomFamily,
		isHighlightedCollisionReservationAtomFamily,
		isHighlightedCapacityReservationAtomFamily,
		openCreateDialogAtom,
		openEditDialogAtom,
		openTableDialogAtom,
	};
};

export type ReservationStateAtoms = ReturnType<
	typeof createReservationStateAtoms
>;
