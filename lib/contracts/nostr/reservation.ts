import { z } from "zod";
import {
	DateStringSchema,
	EmailSchema,
	NonEmptyStringSchema,
	NonNegativeIntegerSchema,
	PhoneSchema,
	PositiveIntegerSchema,
	TimestampMsSchema,
	Timezone,
} from "@/lib/types";

const ReservationNoteSchema = z.string().trim().min(1).max(1000);

export const ReservationFormNumberOfPeopleSchema = z
	.object({
		min: PositiveIntegerSchema,
		max: PositiveIntegerSchema,
		defaultValue: PositiveIntegerSchema,
	})
	.refine((value) => value.min <= value.max, {
		message: "Expected min to be less than or equal to max.",
		path: ["max"],
	})
	.refine(
		(value) =>
			value.defaultValue >= value.min && value.defaultValue <= value.max,
		{
			message: "Expected defaultValue to be within the allowed range.",
			path: ["defaultValue"],
		},
	);

export const ReservationFormContactRequirementsSchema = z.object({
	// UI hint whether email input must be filled before submit.
	isEmailRequired: z.boolean().optional(),
	// UI hint whether phone input must be filled before submit.
	isPhoneRequired: z.boolean().optional(),
});

export const ReservationFormNoteConfigSchema = z
	.object({
		enabled: z.boolean(),
		maxLength: NonNegativeIntegerSchema.optional(),
	})
	.refine(
		(value) =>
			value.maxLength === undefined || value.enabled || value.maxLength === 0,
		{
			message: "maxLength should be omitted when note is disabled.",
			path: ["maxLength"],
		},
	);

export const ReservationFormSlotSchema = z
	.object({
		id: NonEmptyStringSchema,
		startAt: TimestampMsSchema,
		endAt: TimestampMsSchema,
		minNumberOfPeople: PositiveIntegerSchema.optional(),
		maxNumberOfPeople: PositiveIntegerSchema.optional(),
	})
	.refine((value) => value.startAt < value.endAt, {
		message: "Expected startAt to be before endAt.",
		path: ["endAt"],
	})
	.refine(
		(value) =>
			value.minNumberOfPeople === undefined ||
			value.maxNumberOfPeople === undefined ||
			value.minNumberOfPeople <= value.maxNumberOfPeople,
		{
			message:
				"Expected minNumberOfPeople to be less than or equal to maxNumberOfPeople.",
			path: ["maxNumberOfPeople"],
		},
	);

export const ReservationFormDaySchema = z.object({
	// Local date in `ReservationFormData.timezone` (YYYY-MM-DD).
	date: DateStringSchema,
	isSelectable: z.boolean(),
	availableSlotsCount: NonNegativeIntegerSchema.optional(),
	slots: z.array(ReservationFormSlotSchema),
});

export const ReservationFormData = z.object({
	version: z.literal(1),
	generatedAt: TimestampMsSchema,
	// IANA timezone string used to interpret available days and slots.
	timezone: z.enum(Timezone),
	numberOfPeople: ReservationFormNumberOfPeopleSchema,
	contactRequirements: ReservationFormContactRequirementsSchema,
	note: ReservationFormNoteConfigSchema,
	// Ordered by date ascending.
	days: z.array(ReservationFormDaySchema),
});

export type ReservationFormData = z.output<typeof ReservationFormData>;

export const ReservationCreateRequest = z.object({
	version: z.literal(1),
	// Slot selected from `ReservationFormData.days[].slots[]`.
	slotId: NonEmptyStringSchema,
	numberOfPeople: PositiveIntegerSchema,
	name: NonEmptyStringSchema,
	phone: PhoneSchema.optional(),
	email: EmailSchema.optional(),
	note: ReservationNoteSchema.nullable().optional(),
});

export type ReservationCreateRequest = z.output<
	typeof ReservationCreateRequest
>;
