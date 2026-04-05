"use client";

import {
	createIdFromString,
	type KyselyNotNull,
	sqliteTrue,
} from "@evolu/common";
import { useMemo } from "react";
import { OpeningHoursForm } from "@/app/admin/(private)/venue/opening-hours/opening-hours-form";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { createQuery } from "@/lib/evolu";

const weekdayOrder: Record<string, number> = {
	mon: 0,
	tue: 1,
	wed: 2,
	thu: 3,
	fri: 4,
	sat: 5,
	sun: 6,
};

export default function Home() {
	const settingsId = createIdFromString("");

	const settingsQuery = useMemo(
		() =>
			createQuery((db) =>
				db
					.selectFrom("openingHoursSettings")
					.select([
						"openingHoursSettings.id as id",
						"openingHoursSettings.deviceId as deviceId",
						"openingHoursSettings.timezone as timezone",
						"openingHoursSettings.holidayMode as holidayMode",
						"openingHoursSettings.holidayCountryCode as holidayCountryCode",
						"openingHoursSettings.holidayRegionCode as holidayRegionCode",
						"openingHoursSettings.holidayObservedMode as holidayObservedMode",
					] as const)
					.where("openingHoursSettings.isDeleted", "is not", sqliteTrue)
					.where("openingHoursSettings.id", "=", settingsId)
					.where("openingHoursSettings.timezone", "is not", null)
					.where("openingHoursSettings.holidayMode", "is not", null)
					.where("openingHoursSettings.holidayObservedMode", "is not", null)
					.$narrowType<{
						timezone: KyselyNotNull;
						holidayMode: KyselyNotNull;
						holidayObservedMode: KyselyNotNull;
					}>(),
			),
		[settingsId],
	);
	const { data: settingsRows } = useEvoluQuery(settingsQuery);
	const settings = settingsRows[0];

	const regularSlotsQuery = useMemo(
		() =>
			createQuery((db) =>
				db
					.selectFrom("openingHoursRegularSlot")
					.select([
						"openingHoursRegularSlot.id as id",
						"openingHoursRegularSlot.weekday as weekday",
						"openingHoursRegularSlot.openMinute as openMinute",
						"openingHoursRegularSlot.closeMinute as closeMinute",
						"openingHoursRegularSlot.sortOrder as sortOrder",
						"openingHoursRegularSlot.validFrom as validFrom",
						"openingHoursRegularSlot.validTo as validTo",
					] as const)
					.where("openingHoursRegularSlot.isDeleted", "is not", sqliteTrue)
					.where(
						"openingHoursRegularSlot.openingHoursSettingsId",
						"=",
						settingsId,
					)
					.where("openingHoursRegularSlot.weekday", "is not", null)
					.where("openingHoursRegularSlot.openMinute", "is not", null)
					.where("openingHoursRegularSlot.closeMinute", "is not", null)
					.where("openingHoursRegularSlot.sortOrder", "is not", null)
					.$narrowType<{
						weekday: KyselyNotNull;
						openMinute: KyselyNotNull;
						closeMinute: KyselyNotNull;
						sortOrder: KyselyNotNull;
					}>(),
			),
		[settingsId],
	);
	const { data: regularSlotRows } = useEvoluQuery(regularSlotsQuery);

	const exceptionDaysQuery = useMemo(
		() =>
			createQuery((db) =>
				db
					.selectFrom("openingHoursExceptionDay")
					.select([
						"openingHoursExceptionDay.id as id",
						"openingHoursExceptionDay.date as date",
						"openingHoursExceptionDay.mode as mode",
						"openingHoursExceptionDay.note as note",
					] as const)
					.where("openingHoursExceptionDay.isDeleted", "is not", sqliteTrue)
					.where(
						"openingHoursExceptionDay.openingHoursSettingsId",
						"=",
						settingsId,
					)
					.where("openingHoursExceptionDay.date", "is not", null)
					.where("openingHoursExceptionDay.mode", "is not", null)
					.orderBy("openingHoursExceptionDay.date", "asc")
					.$narrowType<{
						date: KyselyNotNull;
						mode: KyselyNotNull;
					}>(),
			),
		[settingsId],
	);
	const { data: exceptionDayRows } = useEvoluQuery(exceptionDaysQuery);

	const exceptionSlotsQuery = useMemo(
		() =>
			createQuery((db) =>
				db
					.selectFrom("openingHoursExceptionSlot")
					.innerJoin(
						"openingHoursExceptionDay",
						"openingHoursExceptionDay.id",
						"openingHoursExceptionSlot.openingHoursExceptionDayId",
					)
					.select([
						"openingHoursExceptionSlot.id as id",
						"openingHoursExceptionSlot.openingHoursExceptionDayId as openingHoursExceptionDayId",
						"openingHoursExceptionSlot.openMinute as openMinute",
						"openingHoursExceptionSlot.closeMinute as closeMinute",
						"openingHoursExceptionSlot.sortOrder as sortOrder",
					] as const)
					.where("openingHoursExceptionSlot.isDeleted", "is not", sqliteTrue)
					.where("openingHoursExceptionDay.isDeleted", "is not", sqliteTrue)
					.where(
						"openingHoursExceptionDay.openingHoursSettingsId",
						"=",
						settingsId,
					)
					.where(
						"openingHoursExceptionSlot.openingHoursExceptionDayId",
						"is not",
						null,
					)
					.where("openingHoursExceptionSlot.openMinute", "is not", null)
					.where("openingHoursExceptionSlot.closeMinute", "is not", null)
					.where("openingHoursExceptionSlot.sortOrder", "is not", null)
					.orderBy("openingHoursExceptionSlot.sortOrder", "asc")
					.$narrowType<{
						openingHoursExceptionDayId: KyselyNotNull;
						openMinute: KyselyNotNull;
						closeMinute: KyselyNotNull;
						sortOrder: KyselyNotNull;
					}>(),
			),
		[settingsId],
	);
	const { data: exceptionSlotRows } = useEvoluQuery(exceptionSlotsQuery);

	const regularSlots = useMemo(
		() =>
			[...regularSlotRows]
				.sort(
					(a, b) =>
						weekdayOrder[a.weekday] - weekdayOrder[b.weekday] ||
						a.sortOrder - b.sortOrder,
				)
				.map((slot) => ({
					id: slot.id,
					weekday: slot.weekday,
					openMinute: slot.openMinute,
					closeMinute: slot.closeMinute,
					validFrom: slot.validFrom ?? "",
					validTo: slot.validTo ?? "",
				})),
		[regularSlotRows],
	);

	const exceptionSlotsByDay = useMemo(() => {
		const map = new Map<string, Array<(typeof exceptionSlotRows)[number]>>();
		for (const slot of exceptionSlotRows) {
			const current = map.get(slot.openingHoursExceptionDayId) ?? [];
			current.push(slot);
			map.set(slot.openingHoursExceptionDayId, current);
		}
		return map;
	}, [exceptionSlotRows]);

	const defaultValues = settings
		? {
				id: settings.id,
				deviceId: settings.deviceId,
				timezone: settings.timezone,
				holidayMode: settings.holidayMode,
				holidayCountryCode: settings.holidayCountryCode,
				holidayRegionCode: settings.holidayRegionCode ?? "",
				holidayObservedMode: settings.holidayObservedMode,
				regularSlots,
				exceptionDays: exceptionDayRows.map((exceptionDay) => ({
					id: exceptionDay.id,
					date: exceptionDay.date,
					mode: exceptionDay.mode,
					note: exceptionDay.note ?? "",
					slots: (exceptionSlotsByDay.get(exceptionDay.id) ?? [])
						.sort((a, b) => a.sortOrder - b.sortOrder)
						.map((slot) => ({
							id: slot.id,
							openMinute: slot.openMinute,
							closeMinute: slot.closeMinute,
						})),
				})),
			}
		: undefined;

	return (
		<div className={"w-full lg:max-w-5xl"}>
			<OpeningHoursForm defaultValues={defaultValues} />
		</div>
	);
}
