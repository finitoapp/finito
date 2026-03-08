import type { Id } from "@evolu/common";
import type { PositiveInteger, TimestampMs } from "@/lib/shared/types";

export type ReservationTag = "booking" | "block";
export type ReservationApprovalStatus = "pending" | "approved" | "rejected";
export type ReservationServiceStatus =
	| "upcoming"
	| "seated"
	| "completed"
	| "noShow";
export type ReservationSource = "manual" | "phone" | "web";

export type ReservationBaseVm = {
	id: Id;
	_tag: ReservationTag;
	tableId: Id | null;
	note: string | null;
	startAt: TimestampMs;
	endAt: TimestampMs;
};

export type ReservationBookingVm = ReservationBaseVm & {
	_tag: "booking";
	name: string;
	phone: string | null;
	email: string | null;
	numberOfPeople: number;
	approvalStatus: ReservationApprovalStatus;
	serviceStatus: ReservationServiceStatus;
	statusReason: string | null;
	source: ReservationSource | null;
};

export type ReservationBlockVm = ReservationBaseVm & {
	_tag: "block";
	label: string;
};

export type ReservationVm = ReservationBookingVm | ReservationBlockVm;

export type TableVm = {
	id: Id;
	label: string;
	numberOfSeats: PositiveInteger;
};

export type DayRange = {
	dayStartMs: TimestampMs;
	dayEndMs: TimestampMs;
	openMs: TimestampMs;
	closeMs: TimestampMs;
};

export type PreviewReservation = {
	id: Id;
	tableId: Id | null;
	startAt: TimestampMs;
	endAt: TimestampMs;
};

export type DraftReservation = {
	id?: Id;
	_tag: ReservationTag;
	name: string;
	phone: string;
	email: string;
	label: string;
	note: string;
	numberOfPeople: string;
	approvalStatus: ReservationApprovalStatus;
	serviceStatus: ReservationServiceStatus;
	statusReason: string;
	source: ReservationSource | "";
	tableId: string;
	startAtLocal: string;
	durationMinutes: string;
};

export type SlotSelectionPreview = {
	tableId: Id;
	startSlotIndex: number;
	endSlotIndex: number;
};

export type LongPressPreview = {
	tableId: Id;
	slotIndex: number;
	progress: number;
};

export type DragMode = "move" | "resize";

export type DragOperation = {
	reservationId: Id;
	mode: DragMode;
	originalStartAt: number;
	originalEndAt: number;
	originalTableId: Id | null;
	slotWidthPx: number;
	startClientX: number;
	startClientY: number;
	isDragging: boolean;
};
