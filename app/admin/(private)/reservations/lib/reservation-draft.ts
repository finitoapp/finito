import type { Id } from "@evolu/common";
import { CALENDAR_SETTINGS } from "@/app/admin/(private)/reservations/lib/calendar-math";
import { formatDateTimeLocal } from "@/app/admin/(private)/reservations/lib/date-time";
import type {
	DraftReservation,
	ReservationTag,
	ReservationVm,
} from "@/app/admin/(private)/reservations/lib/types";

export const createDraftFromCreate = (params: {
	timezone: string;
	_tag?: ReservationTag;
	tableId: Id | null;
	startAt: number;
	durationMinutes?: number;
}): DraftReservation => ({
	_tag: params._tag ?? "reservationBooking",
	name: "",
	phone: "",
	email: "",
	label: "",
	note: "",
	numberOfPeople: "2",
	approvalStatus: "pending",
	serviceStatus: "upcoming",
	statusReason: "",
	source: "manual",
	tableId: params.tableId ?? "",
	startAtLocal: formatDateTimeLocal(params.startAt, params.timezone),
	durationMinutes: String(
		params.durationMinutes ?? CALENDAR_SETTINGS.defaultDurationMinutes,
	),
});

export const createDraftFromReservation = (params: {
	timezone: string;
	reservation: ReservationVm;
}): DraftReservation => {
	const durationMinutes = Math.max(
		CALENDAR_SETTINGS.slotMinutes,
		Math.round(
			(params.reservation.endAt - params.reservation.startAt) / (60 * 1000),
		),
	);

	if (params.reservation._tag === "reservationBlock") {
		return {
			id: params.reservation.id,
			_tag: "reservationBlock",
			name: "",
			phone: "",
			email: "",
			label: params.reservation.label,
			note: params.reservation.note ?? "",
			numberOfPeople: "2",
			approvalStatus: "pending",
			serviceStatus: "upcoming",
			statusReason: "",
			source: "manual",
			tableId: params.reservation.tableId ?? "",
			startAtLocal: formatDateTimeLocal(
				params.reservation.startAt,
				params.timezone,
			),
			durationMinutes: String(durationMinutes),
		};
	}

	return {
		id: params.reservation.id,
		_tag: "reservationBooking",
		name: params.reservation.name,
		phone: params.reservation.phone ?? "",
		email: params.reservation.email ?? "",
		label: "",
		note: params.reservation.note ?? "",
		numberOfPeople: String(params.reservation.numberOfPeople),
		approvalStatus: params.reservation.approvalStatus,
		serviceStatus: params.reservation.serviceStatus,
		statusReason: params.reservation.statusReason ?? "",
		source: params.reservation.source ?? "",
		tableId: params.reservation.tableId ?? "",
		startAtLocal: formatDateTimeLocal(
			params.reservation.startAt,
			params.timezone,
		),
		durationMinutes: String(durationMinutes),
	};
};
