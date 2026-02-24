import {
	createId,
	createRandomBytes,
	getOrThrow,
	type Id,
	sqliteTrue,
} from "@evolu/common";
import { fromZonedTime } from "date-fns-tz";
import { merge } from "es-toolkit";
import type React from "react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { PartialDeep } from "type-fest";
import { z } from "zod";
import { AutoForm, createAutoFormLayout } from "@/components/auto-form";
import { createComboboxInput } from "@/components/combobox-input";
import { useActionForm } from "@/hooks/use-action-form";
import { useEvolu } from "@/hooks/use-evolu";
import {
	EmailSchema,
	NonEmptyStringSchema,
	PhoneSchema,
	PositiveIntegerSchema,
	StringToNullableStringSchema,
	StringToNumberSchema,
	StringToUndefinedStringSchema,
} from "@/lib/shared/types";

const reservationApprovalStatusValues = [
	"pending",
	"approved",
	"rejected",
] as const;
const reservationServiceStatusValues = [
	"upcoming",
	"seated",
	"completed",
	"noShow",
] as const;
const reservationSourceValues = ["manual", "phone", "web"] as const;

const reservationBaseSchema = z.object({
	id: StringToUndefinedStringSchema.pipe(NonEmptyStringSchema.optional()),
	note: StringToNullableStringSchema.pipe(NonEmptyStringSchema.nullable()),
	tableId: StringToNullableStringSchema.pipe(NonEmptyStringSchema.nullable()),
	startAtLocal: StringToUndefinedStringSchema.pipe(NonEmptyStringSchema),
	durationMinutes: StringToNumberSchema.pipe(PositiveIntegerSchema).refine(
		(value) => value % 30 === 0,
		{
			error: "Duration must be aligned to 30 minutes.",
		},
	),
});

const reservationFormSchema = z
	.discriminatedUnion("_tag", [
		reservationBaseSchema.extend({
			_tag: z.literal("reservationBooking"),
			name: StringToNullableStringSchema.pipe(NonEmptyStringSchema),
			phone: StringToNullableStringSchema.pipe(PhoneSchema.nullable()),
			email: StringToNullableStringSchema.pipe(EmailSchema.nullable()),
			numberOfPeople: StringToNumberSchema.pipe(PositiveIntegerSchema),
			approvalStatus: z.enum(reservationApprovalStatusValues),
			serviceStatus: z.enum(reservationServiceStatusValues),
			statusReason: StringToNullableStringSchema.pipe(
				NonEmptyStringSchema.nullable(),
			),
			source: StringToNullableStringSchema.pipe(
				z.enum(reservationSourceValues).nullable(),
			),
			label: StringToNullableStringSchema.pipe(NonEmptyStringSchema.nullable()),
		}),
		reservationBaseSchema.extend({
			_tag: z.literal("reservationBlock"),
			label: StringToNullableStringSchema.pipe(NonEmptyStringSchema),
			name: StringToNullableStringSchema.pipe(NonEmptyStringSchema.nullable()),
			phone: StringToNullableStringSchema.pipe(PhoneSchema.nullable()),
			email: StringToNullableStringSchema.pipe(EmailSchema.nullable()),
			numberOfPeople: StringToNumberSchema.pipe(PositiveIntegerSchema),
			approvalStatus: z.enum(reservationApprovalStatusValues),
			serviceStatus: z.enum(reservationServiceStatusValues),
			statusReason: StringToNullableStringSchema.pipe(
				NonEmptyStringSchema.nullable(),
			),
			source: StringToNullableStringSchema.pipe(
				z.enum(reservationSourceValues).nullable(),
			),
		}),
	])
	.superRefine((value, context) => {
		if (
			value._tag === "reservationBooking" &&
			value.approvalStatus === "approved" &&
			value.tableId === null
		) {
			context.addIssue({
				code: "custom",
				path: ["tableId"],
				message: "Approved reservation must have an assigned table.",
			});
		}
	});

const createDefaults = () =>
	({
		id: "",
		_tag: "reservationBooking",
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
		tableId: "",
		startAtLocal: "",
		durationMinutes: "60",
	}) satisfies z.input<typeof reservationFormSchema>;

export const ReservationForm: React.FC<{
	defaultValues?: PartialDeep<z.input<typeof reservationFormSchema>>;
	tables: ReadonlyArray<{ id: string; label: string }>;
	timezone: string;
	onSuccess?: (newId: Id) => unknown;
}> = ({ defaultValues: partialDefaults, tables, timezone, onSuccess }) => {
	const { t } = useTranslation();
	const evolu = useEvolu();
	const [defaultValues] = useState(() =>
		merge(createDefaults(), partialDefaults ?? {}),
	);
	const tableItems = useMemo(
		() => [
			{
				label: t("reservations:form.table.unassigned"),
				value: "",
			},
			...tables.map((table) => ({
				label: table.label,
				value: table.id,
			})),
		],
		[t, tables],
	);
	const components = useMemo(() => {
		const TableComboboxInput = createComboboxInput({
			label: t("reservations:form.fields.tableId"),
			placeholder: t("reservations:form.fields.tableId"),
			items: tableItems,
		});
		return createAutoFormLayout(reservationFormSchema, ({ builder }) => ({
			...builder.magicInput("id").text({
				type: "hidden",
			}),
			...builder.magicInput("_tag").select({
				label: t("reservations:form.fields._tag"),
				variant: "toggle",
				allowEmpty: false,
				values: {
					reservationBooking: t("reservations:form.tag.reservationBooking"),
					reservationBlock: t("reservations:form.tag.reservationBlock"),
				},
			}),
			...builder.when("_tag", "reservationBooking", {
				...builder.magicInput("name").text({
					label: t("reservations:form.fields.name"),
				}),
				...builder.line({
					...builder.magicInput("phone").text({
						label: t("reservations:form.fields.phone"),
						type: "tel",
					}),
					...builder.magicInput("email").text({
						label: t("reservations:form.fields.email"),
						type: "email",
					}),
				}),
				...builder.magicInput("numberOfPeople").text({
					label: t("reservations:form.fields.numberOfPeople"),
					type: "number",
				}),
				...builder.line({
					...builder.magicInput("approvalStatus").select({
						label: t("reservations:form.fields.approvalStatus"),
						allowEmpty: false,
						values: {
							pending: t("reservations:form.approval.pending"),
							approved: t("reservations:form.approval.approved"),
							rejected: t("reservations:form.approval.rejected"),
						},
					}),
					...builder.magicInput("serviceStatus").select({
						label: t("reservations:form.fields.serviceStatus"),
						allowEmpty: false,
						values: {
							upcoming: t("reservations:form.service.upcoming"),
							seated: t("reservations:form.service.seated"),
							completed: t("reservations:form.service.completed"),
							noShow: t("reservations:form.service.noShow"),
						},
					}),
				}),
				...builder.magicInput("source").select({
					label: t("reservations:form.fields.source"),
					values: {
						manual: t("reservations:form.source.manual"),
						phone: t("reservations:form.source.phone"),
						web: t("reservations:form.source.web"),
					},
					allowEmpty: true,
				}),
				...builder.when("approvalStatus", "rejected", {
					...builder.magicInput("statusReason").textarea({
						label: t("reservations:form.fields.statusReason"),
					}),
				}),
			}),
			...builder.when("_tag", "reservationBlock", {
				...builder.magicInput("label").text({
					label: t("reservations:form.fields.label"),
				}),
			}),
			...builder.magicInput("note").textarea({
				label: t("reservations:form.fields.note"),
			}),
			...builder.line({
				...builder.magicInput("durationMinutes").text({
					label: t("reservations:form.fields.durationMinutes"),
					type: "number",
				}),
			}),
			...builder.magicInput("startAtLocal").text({
				label: t("reservations:form.fields.startAtLocal"),
				type: "datetime-local",
			}),
			...builder.createComponent("tableId", (fieldProps) => (
				<TableComboboxInput {...fieldProps} />
			)),
		}));
	}, [t, tableItems]);
	const form = useActionForm(reservationFormSchema, {
		defaultValues,
		saveAction: async (values) => {
			const id = values.id ?? createId({ randomBytes: createRandomBytes() });
			const startAt = fromZonedTime(values.startAtLocal, timezone).getTime();
			const endAt = startAt + values.durationMinutes * 60 * 1000;

			getOrThrow(
				evolu.upsert(
					"reservation",
					{
						id,
						_tag: values._tag,
						note: values.note,
						tableId: values.tableId,
						startAt,
						endAt,
					},
					{
						onComplete: () => {
							onSuccess?.(id as Id);
						},
					},
				),
			);

			if (values._tag === "reservationBooking") {
				getOrThrow(
					evolu.upsert("reservationBooking", {
						id,
						name: values.name,
						phone: values.phone,
						email: values.email,
						numberOfPeople: values.numberOfPeople,
						approvalStatus: values.approvalStatus,
						serviceStatus: values.serviceStatus,
						statusReason: values.statusReason,
						source: values.source,
					}),
				);
				if (values.id !== undefined) {
					getOrThrow(
						evolu.update("reservationBlock", {
							id,
							isDeleted: sqliteTrue,
						}),
					);
				}
				return;
			}

			getOrThrow(
				evolu.upsert("reservationBlock", {
					id,
					label: values.label,
				}),
			);
			if (values.id !== undefined) {
				getOrThrow(
					evolu.update("reservationBooking", {
						id,
						isDeleted: sqliteTrue,
					}),
				);
			}
		},
	});

	return <AutoForm form={form} components={components} />;
};
