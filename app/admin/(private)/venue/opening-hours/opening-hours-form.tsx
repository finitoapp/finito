import {
	createId,
	createIdFromString,
	createRandomBytes,
	type Id,
	sqliteTrue,
} from "@evolu/common";
import { merge } from "es-toolkit";
import type React from "react";
import { useMemo, useState } from "react";
import type { PartialDeep } from "type-fest";
import { z } from "zod";
import { AutoForm, createAutoFormLayout } from "@/components/auto-form";
import { useActionForm } from "@/hooks/use-action-form";
import { useEvolu } from "@/hooks/use-evolu";
import { TableIdSchema } from "@/lib/evolu/types";
import {
	CountryCode,
	DateStringSchema,
	NonEmptyString32Schema,
	NonEmptyString255Schema,
	NonNegativeInteger,
	StringToNullableStringSchema,
	TimeStringSchema,
	Timezone,
} from "@/lib/shared/types";

const OpeningHoursWeekday = {
	mon: "mon",
	tue: "tue",
	wed: "wed",
	thu: "thu",
	fri: "fri",
	sat: "sat",
	sun: "sun",
} as const;

const OpeningHoursHolidayMode = {
	manualOnly: "manualOnly",
	closeOnPublicHolidays: "closeOnPublicHolidays",
} as const;

const OpeningHoursHolidayObservedMode = {
	none: "none",
	observed: "observed",
} as const;

const OpeningHoursExceptionMode = {
	closed: "closed",
	custom: "custom",
} as const;

const OpeningHoursWeekdaySchema = z.enum(OpeningHoursWeekday);
const OpeningHoursHolidayModeSchema = z.enum(OpeningHoursHolidayMode);
const OpeningHoursHolidayObservedModeSchema = z.enum(
	OpeningHoursHolidayObservedMode,
);
const OpeningHoursExceptionModeSchema = z.enum(OpeningHoursExceptionMode);

const regularSlotSchema = z.object({
	id: TableIdSchema,
	weekday: OpeningHoursWeekdaySchema,
	openMinute: StringToNullableStringSchema.pipe(TimeStringSchema),
	closeMinute: StringToNullableStringSchema.pipe(TimeStringSchema),
	validFrom: StringToNullableStringSchema.pipe(DateStringSchema.nullable()),
	validTo: StringToNullableStringSchema.pipe(DateStringSchema.nullable()),
});

const exceptionSlotSchema = z.object({
	id: TableIdSchema,
	openMinute: StringToNullableStringSchema.pipe(TimeStringSchema),
	closeMinute: StringToNullableStringSchema.pipe(TimeStringSchema),
});

const exceptionDaySchema = z.object({
	id: TableIdSchema,
	date: StringToNullableStringSchema.pipe(DateStringSchema),
	mode: OpeningHoursExceptionModeSchema,
	note: StringToNullableStringSchema.pipe(NonEmptyString255Schema.nullable()),
	slots: exceptionSlotSchema.array().readonly(),
});

export const openingHoursFormSchema = z
	.object({
		id: TableIdSchema,
		deviceId: TableIdSchema.nullable(),
		timezone: z.enum(Timezone),
		holidayMode: OpeningHoursHolidayModeSchema,
		holidayCountryCode: z.enum(CountryCode).nullable(),
		holidayRegionCode: StringToNullableStringSchema.pipe(
			NonEmptyString32Schema.nullable(),
		),
		holidayObservedMode: OpeningHoursHolidayObservedModeSchema,
		regularSlots: regularSlotSchema.array().readonly(),
		exceptionDays: exceptionDaySchema.array().readonly(),
	})
	.superRefine((value, context) => {
		if (
			value.holidayMode === OpeningHoursHolidayMode.closeOnPublicHolidays &&
			value.holidayCountryCode === null
		) {
			context.addIssue({
				code: "custom",
				path: ["holidayCountryCode"],
				message:
					"Holiday country is required when automatic public holidays are enabled.",
			});
		}

		const toMinutes = (time: z.output<typeof TimeStringSchema>) => {
			const [hours, minutes] = time.split(":");
			return Number(hours) * 60 + Number(minutes);
		};

		const addSlotOrderingIssues = (
			slots: Array<{
				index: number;
				openMinute: z.output<typeof TimeStringSchema>;
				closeMinute: z.output<typeof TimeStringSchema>;
			}>,
			pathPrefix: ReadonlyArray<string | number>,
		) => {
			for (const slot of slots) {
				if (toMinutes(slot.openMinute) >= toMinutes(slot.closeMinute)) {
					context.addIssue({
						code: "custom",
						path: [...pathPrefix, slot.index, "closeMinute"],
						message: "Close time must be after open time.",
					});
				}
			}

			const sortedByStart = [...slots].sort(
				(a, b) => toMinutes(a.openMinute) - toMinutes(b.openMinute),
			);

			for (let index = 1; index < sortedByStart.length; index++) {
				const previous = sortedByStart[index - 1];
				const current = sortedByStart[index];

				if (toMinutes(previous.closeMinute) > toMinutes(current.openMinute)) {
					context.addIssue({
						code: "custom",
						path: [...pathPrefix, current.index, "openMinute"],
						message: "Time intervals must not overlap.",
					});
				}
			}
		};

		const groupedRegularSlots = new Map<
			string,
			Array<{
				index: number;
				openMinute: z.output<typeof TimeStringSchema>;
				closeMinute: z.output<typeof TimeStringSchema>;
			}>
		>();

		value.regularSlots.forEach((slot, index) => {
			if (
				slot.validFrom !== null &&
				slot.validTo !== null &&
				slot.validFrom > slot.validTo
			) {
				context.addIssue({
					code: "custom",
					path: ["regularSlots", index, "validTo"],
					message: "Valid to must be on or after valid from.",
				});
			}

			const key = [slot.weekday, slot.validFrom ?? "", slot.validTo ?? ""].join(
				"|",
			);
			const grouped = groupedRegularSlots.get(key);
			const item = {
				index,
				openMinute: slot.openMinute,
				closeMinute: slot.closeMinute,
			};

			if (grouped === undefined) {
				groupedRegularSlots.set(key, [item]);
				return;
			}

			grouped.push(item);
		});

		for (const grouped of groupedRegularSlots.values()) {
			addSlotOrderingIssues(grouped, ["regularSlots"]);
		}

		const seenExceptionDates = new Set<string>();

		value.exceptionDays.forEach((exceptionDay, exceptionDayIndex) => {
			if (seenExceptionDates.has(exceptionDay.date)) {
				context.addIssue({
					code: "custom",
					path: ["exceptionDays", exceptionDayIndex, "date"],
					message: "Each exception date can be defined only once.",
				});
			}
			seenExceptionDates.add(exceptionDay.date);

			if (exceptionDay.mode === OpeningHoursExceptionMode.closed) {
				if (exceptionDay.slots.length > 0) {
					context.addIssue({
						code: "custom",
						path: ["exceptionDays", exceptionDayIndex, "slots"],
						message: "Closed exception day must not contain any time slots.",
					});
				}
				return;
			}

			if (exceptionDay.slots.length === 0) {
				context.addIssue({
					code: "custom",
					path: ["exceptionDays", exceptionDayIndex, "slots"],
					message: "Custom exception day must contain at least one time slot.",
				});
				return;
			}

			addSlotOrderingIssues(
				exceptionDay.slots.map((slot, slotIndex) => ({
					index: slotIndex,
					openMinute: slot.openMinute,
					closeMinute: slot.closeMinute,
				})),
				["exceptionDays", exceptionDayIndex, "slots"],
			);
		});
	});

const createIdDeps = {
	randomBytes: createRandomBytes(),
};

const createRegularSlotDefaultValue = () => ({
	id: createId(createIdDeps),
	weekday: OpeningHoursWeekday.mon,
	openMinute: "09:00",
	closeMinute: "17:00",
	validFrom: "",
	validTo: "",
});

const createExceptionSlotDefaultValue = () => ({
	id: createId(createIdDeps),
	openMinute: "09:00",
	closeMinute: "17:00",
});

const createExceptionDayDefaultValue = () => ({
	id: createId(createIdDeps),
	date: "",
	mode: OpeningHoursExceptionMode.closed,
	note: "",
	slots: [],
});

export const createOpeningHoursDefaultValues = () =>
	({
		id: createIdFromString(""),
		deviceId: null,
		timezone: Timezone["Europe/Prague"],
		holidayMode: OpeningHoursHolidayMode.manualOnly,
		holidayCountryCode: null,
		holidayRegionCode: "",
		holidayObservedMode: OpeningHoursHolidayObservedMode.none,
		regularSlots: [],
		exceptionDays: [],
	}) satisfies z.input<typeof openingHoursFormSchema>;

const weekdayLabels = {
	[OpeningHoursWeekday.mon]: "Monday",
	[OpeningHoursWeekday.tue]: "Tuesday",
	[OpeningHoursWeekday.wed]: "Wednesday",
	[OpeningHoursWeekday.thu]: "Thursday",
	[OpeningHoursWeekday.fri]: "Friday",
	[OpeningHoursWeekday.sat]: "Saturday",
	[OpeningHoursWeekday.sun]: "Sunday",
} as const satisfies Record<z.infer<typeof OpeningHoursWeekdaySchema>, string>;

const holidayModeLabels = {
	[OpeningHoursHolidayMode.manualOnly]: "Only manual exceptions",
	[OpeningHoursHolidayMode.closeOnPublicHolidays]:
		"Close automatically on public holidays",
} as const satisfies Record<
	z.infer<typeof OpeningHoursHolidayModeSchema>,
	string
>;

const holidayObservedModeLabels = {
	[OpeningHoursHolidayObservedMode.none]: "Calendar date only",
	[OpeningHoursHolidayObservedMode.observed]: "Include observed holiday dates",
} as const satisfies Record<
	z.infer<typeof OpeningHoursHolidayObservedModeSchema>,
	string
>;

const exceptionModeLabels = {
	[OpeningHoursExceptionMode.closed]: "Closed all day",
	[OpeningHoursExceptionMode.custom]: "Custom time slots",
} as const satisfies Record<
	z.infer<typeof OpeningHoursExceptionModeSchema>,
	string
>;

const createComponents = () =>
	createAutoFormLayout(openingHoursFormSchema, ({ builder }) => ({
		...builder.magicInput("id").hidden(undefined),
		...builder.magicInput("deviceId").hidden(undefined),

		...builder.card(
			{
				title: "Global Policy",
				description: "Global defaults used when no date exception is defined.",
			},
			{
				...builder.magicInput("timezone").select({
					label: "Timezone",
					allowEmpty: false,
					values: Timezone,
				}),
				...builder.magicInput("holidayMode").select({
					label: "Public Holiday Mode",
					allowEmpty: false,
					values: holidayModeLabels,
				}),
				...builder.magicInput("holidayCountryCode").select({
					label: "Holiday Country (optional)",
					allowEmpty: true,
					values: CountryCode,
					emptyTitle: "None",
				}),
				...builder.magicInput("holidayRegionCode").text({
					label: "Holiday Region Code (optional)",
					placeholder: "e.g. CZ-10",
				}),
				...builder.magicInput("holidayObservedMode").select({
					label: "Observed Holiday Handling",
					allowEmpty: false,
					values: holidayObservedModeLabels,
				}),
			},
		),

		...builder.card(
			{
				title: "Regular Opening Hours",
				description:
					"Add one or more time slots per weekday. Use validity dates for seasonal rules.",
			},
			{
				...builder.arrayTableField(
					{
						name: "regularSlots",
						addRowLabel: "Add regular slot",
						defaultValue: createRegularSlotDefaultValue,
						columns: [
							{
								hidden: true,
							},
							{
								title: "Weekday",
								className: "w-[190px]",
							},
							{
								title: "Opens",
								className: "w-[140px]",
							},
							{
								title: "Closes",
								className: "w-[140px]",
							},
							{
								title: "Valid from",
								className: "w-[170px]",
							},
							{
								title: "Valid to",
								className: "w-[170px]",
							},
						],
					},
					({ builder }) => ({
						...builder.magicInput("id").hidden(undefined),
						...builder.magicInput("weekday").select({
							allowEmpty: false,
							values: weekdayLabels,
						}),
						...builder.magicInput("openMinute").text({
							type: "time",
						}),
						...builder.magicInput("closeMinute").text({
							type: "time",
						}),
						...builder.magicInput("validFrom").text({
							type: "date",
						}),
						...builder.magicInput("validTo").text({
							type: "date",
						}),
					}),
				),
			},
		),

		...builder.card(
			{
				title: "Date Exceptions",
				description:
					"Use this for holidays and one-off days. Exceptions override global and regular rules.",
			},
			{
				...builder.arrayField(
					{
						name: "exceptionDays",
						defaultValue: createExceptionDayDefaultValue,
					},
					({ builder }) => ({
						...builder.magicInput("id").hidden(undefined),
						...builder.line({
							...builder.magicInput("date").text({
								label: "Date",
								type: "date",
							}),
							...builder.magicInput("mode").select({
								label: "Mode",
								allowEmpty: false,
								values: exceptionModeLabels,
							}),
						}),
						...builder.magicInput("note").text({
							label: "Note (optional)",
						}),
						...builder.arrayTableField(
							{
								name: "slots",
								addRowLabel: "Add exception slot",
								defaultValue: createExceptionSlotDefaultValue,
								columns: [
									{
										hidden: true,
									},
									{
										title: "Opens",
										className: "w-[140px]",
									},
									{
										title: "Closes",
										className: "w-[140px]",
									},
								],
							},
							({ builder }) => ({
								...builder.magicInput("id").hidden(undefined),
								...builder.magicInput("openMinute").text({
									type: "time",
								}),
								...builder.magicInput("closeMinute").text({
									type: "time",
								}),
							}),
						),
					}),
				),
			},
		),
	}));

export const OpeningHoursForm: React.FC<{
	defaultValues?: PartialDeep<z.input<typeof openingHoursFormSchema>>;
	onSuccess?: (newEventId: Id) => unknown;
}> = (params) => {
	const evolu = useEvolu();
	const [defaultValues] = useState(() =>
		merge(createOpeningHoursDefaultValues(), params.defaultValues ?? {}),
	);
	const components = useMemo(() => createComponents(), []);
	const form = useActionForm(openingHoursFormSchema, {
		defaultValues,
		saveAction: async (values) => {
			const settingsId = values.id;

			evolu.upsert(
				"openingHoursSettings",
				{
					id: settingsId,
					deviceId: values.deviceId,
					timezone: values.timezone,
					holidayMode: values.holidayMode,
					holidayCountryCode: values.holidayCountryCode,
					holidayRegionCode: values.holidayRegionCode,
					holidayObservedMode: values.holidayObservedMode,
				},
				{
					onComplete: () => {
						if (params.onSuccess) {
							params.onSuccess(settingsId);
						}
					},
				},
			);

			const originalRegularSlotIds = new Set(
				(params.defaultValues?.regularSlots ?? [])
					.map((slot) => slot?.id)
					.filter((id): id is Id => id !== undefined),
			);

			const originalExceptionDayIds = new Set(
				(params.defaultValues?.exceptionDays ?? [])
					.map((exceptionDay) => exceptionDay?.id)
					.filter((id): id is Id => id !== undefined),
			);

			const originalExceptionSlotIds = new Set(
				(params.defaultValues?.exceptionDays ?? [])
					.flatMap((exceptionDay) => exceptionDay?.slots ?? [])
					.map((slot) => slot?.id)
					.filter((id): id is Id => id !== undefined),
			);

			const weekdaySortOrder = new Map<string, number>();
			for (const regularSlot of values.regularSlots) {
				originalRegularSlotIds.delete(regularSlot.id);

				const sortOrder = NonNegativeInteger(
					weekdaySortOrder.get(regularSlot.weekday) ?? 0,
				);
				weekdaySortOrder.set(regularSlot.weekday, sortOrder + 1);

				evolu.upsert("openingHoursRegularSlot", {
					id: regularSlot.id,
					openingHoursSettingsId: settingsId,
					weekday: regularSlot.weekday,
					openMinute: regularSlot.openMinute,
					closeMinute: regularSlot.closeMinute,
					sortOrder,
					validFrom: regularSlot.validFrom,
					validTo: regularSlot.validTo,
				});
			}

			for (const exceptionDay of values.exceptionDays) {
				originalExceptionDayIds.delete(exceptionDay.id);

				evolu.upsert("openingHoursExceptionDay", {
					id: exceptionDay.id,
					openingHoursSettingsId: settingsId,
					date: exceptionDay.date,
					mode: exceptionDay.mode,
					note: exceptionDay.note,
				});

				if (exceptionDay.mode === OpeningHoursExceptionMode.closed) {
					continue;
				}

				for (const [slotIndex, slot] of exceptionDay.slots.entries()) {
					originalExceptionSlotIds.delete(slot.id);

					evolu.upsert("openingHoursExceptionSlot", {
						id: slot.id,
						openingHoursExceptionDayId: exceptionDay.id,
						openMinute: slot.openMinute,
						closeMinute: slot.closeMinute,
						sortOrder: NonNegativeInteger(slotIndex),
					});
				}
			}

			for (const regularSlotId of originalRegularSlotIds) {
				evolu.update("openingHoursRegularSlot", {
					id: regularSlotId,
					isDeleted: sqliteTrue,
				});
			}

			for (const exceptionSlotId of originalExceptionSlotIds) {
				evolu.update("openingHoursExceptionSlot", {
					id: exceptionSlotId,
					isDeleted: sqliteTrue,
				});
			}

			for (const exceptionDayId of originalExceptionDayIds) {
				evolu.update("openingHoursExceptionDay", {
					id: exceptionDayId,
					isDeleted: sqliteTrue,
				});
			}
		},
	});

	return <AutoForm form={form} components={components} />;
};
