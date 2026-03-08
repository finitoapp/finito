import { CalendarDaysIcon, UsersIcon } from "lucide-react";
import type { FC } from "react";
import { useEffect, useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ScreenData } from "@/lib/bill/driver";

type ReservationScreenProps = {
	screen: Extract<ScreenData, { variant: "reservation" }>;
};

export const ReservationScreen: FC<ReservationScreenProps> = ({ screen }) => {
	const { i18n, t } = useTranslation();
	const timezone = screen.payload.timezone;
	const idPrefix = useId();
	const dateFieldId = `${idPrefix}-reservation-date`;
	const peopleFieldId = `${idPrefix}-reservation-people`;
	const slotFieldId = `${idPrefix}-reservation-slot`;
	const emailFieldId = `${idPrefix}-reservation-email`;
	const phoneFieldId = `${idPrefix}-reservation-phone`;
	const noteFieldId = `${idPrefix}-reservation-note`;

	const selectableDays = useMemo(
		() => screen.payload.days.filter((day) => day.isSelectable),
		[screen.payload.days],
	);

	const [selectedDate, setSelectedDate] = useState<string | null>(
		selectableDays[0]?.date ?? null,
	);
	const [numberOfPeople, setNumberOfPeople] = useState<number>(
		Number(screen.payload.numberOfPeople.defaultValue),
	);
	const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
	const [email, setEmail] = useState("");
	const [phone, setPhone] = useState("");
	const [note, setNote] = useState("");
	const numberOfPeopleOptions = useMemo(() => {
		const min = Number(screen.payload.numberOfPeople.min);
		const max = Number(screen.payload.numberOfPeople.max);
		return Array.from({ length: Math.max(0, max - min + 1) }, (_, index) => {
			const value = min + index;
			return {
				value,
				label: `${value}`,
			};
		});
	}, [screen.payload.numberOfPeople.max, screen.payload.numberOfPeople.min]);

	useEffect(() => {
		setSelectedDate(selectableDays[0]?.date ?? null);
	}, [selectableDays]);

	useEffect(() => {
		const nextValue = Math.min(
			Math.max(numberOfPeople, Number(screen.payload.numberOfPeople.min)),
			Number(screen.payload.numberOfPeople.max),
		);
		if (nextValue !== numberOfPeople) {
			setNumberOfPeople(nextValue);
		}
	}, [
		numberOfPeople,
		screen.payload.numberOfPeople.max,
		screen.payload.numberOfPeople.min,
	]);

	const selectedDay = useMemo(
		() =>
			selectedDate === null
				? null
				: (screen.payload.days.find((day) => day.date === selectedDate) ??
					null),
		[selectedDate, screen.payload.days],
	);

	const filteredSlots = useMemo(() => {
		if (!selectedDay) return [];

		return selectedDay.slots.filter((slot) => {
			const min = slot.minNumberOfPeople
				? Number(slot.minNumberOfPeople)
				: Number(screen.payload.numberOfPeople.min);
			const max = slot.maxNumberOfPeople
				? Number(slot.maxNumberOfPeople)
				: Number(screen.payload.numberOfPeople.max);
			return numberOfPeople >= min && numberOfPeople <= max;
		});
	}, [
		numberOfPeople,
		screen.payload.numberOfPeople.max,
		screen.payload.numberOfPeople.min,
		selectedDay,
	]);

	useEffect(() => {
		if (filteredSlots.some((slot) => slot.id === selectedSlotId)) {
			return;
		}
		setSelectedSlotId(filteredSlots[0]?.id ?? null);
	}, [filteredSlots, selectedSlotId]);

	const formatDayLabel = (date: string) => {
		const [year, month, day] = date.split("-").map(Number);
		return new Intl.DateTimeFormat(i18n.language, {
			weekday: "short",
			day: "numeric",
			month: "short",
			timeZone: timezone,
		}).format(new Date(Date.UTC(year, month - 1, day, 12, 0, 0)));
	};

	const formatDateTime = (timestamp: number) =>
		new Intl.DateTimeFormat(i18n.language, {
			dateStyle: "medium",
			timeStyle: "short",
			timeZone: timezone,
		}).format(new Date(timestamp));

	const formatTime = (timestamp: number) =>
		new Intl.DateTimeFormat(i18n.language, {
			timeStyle: "short",
			timeZone: timezone,
		}).format(new Date(timestamp));

	const selectedSlot =
		selectedSlotId === null
			? null
			: (filteredSlots.find((slot) => slot.id === selectedSlotId) ?? null);
	const isEmailRequired =
		screen.payload.contactRequirements.isEmailRequired === true;
	const isPhoneRequired =
		screen.payload.contactRequirements.isPhoneRequired === true;
	const canSubmit =
		selectedSlot !== null &&
		(!isEmailRequired || email.trim().length > 0) &&
		(!isPhoneRequired || phone.trim().length > 0);

	return (
		<div className="mb-28 flex flex-col grow px-4">
			<div className="flex flex-col gap-6">
				<div className="rounded-xl border bg-card p-4 shadow-sm">
					<div className="mb-4 flex items-center gap-2 text-foreground">
						<CalendarDaysIcon className="size-4 text-muted-foreground" />
						<h2 className="text-lg font-semibold tracking-tight">
							{t("client:paymentPage.reservation.title")}
						</h2>
					</div>

					<div className="space-y-4">
						<div className="space-y-2">
							<label
								className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"
								htmlFor={dateFieldId}
							>
								{t("client:paymentPage.reservation.fields.date")}
							</label>
							<select
								id={dateFieldId}
								className="w-full rounded-md border bg-background px-3 py-2 text-sm"
								value={selectedDate ?? ""}
								onChange={(event) =>
									setSelectedDate(event.target.value || null)
								}
							>
								{screen.payload.days.map((day) => (
									<option
										key={day.date}
										value={day.date}
										disabled={!day.isSelectable}
									>
										{formatDayLabel(day.date)}
										{!day.isSelectable
											? ` (${t("client:paymentPage.reservation.labels.closed")})`
											: ""}
										{day.availableSlotsCount !== undefined
											? ` • ${t(
													"client:paymentPage.reservation.labels.slotCount",
													{
														count: day.availableSlotsCount,
													},
												)}`
											: ""}
									</option>
								))}
							</select>
						</div>

						<div className="space-y-2">
							<label
								className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"
								htmlFor={peopleFieldId}
							>
								{t("client:paymentPage.reservation.fields.numberOfPeople")}
							</label>
							<div className="flex items-center gap-2">
								<UsersIcon className="size-4 text-muted-foreground" />
								<select
									id={peopleFieldId}
									className="w-full rounded-md border bg-background px-3 py-2 text-sm"
									value={numberOfPeople}
									onChange={(event) => {
										const parsed = Number.parseInt(event.target.value, 10);
										if (Number.isNaN(parsed)) return;
										setNumberOfPeople(parsed);
									}}
								>
									{numberOfPeopleOptions.map((option) => (
										<option key={option.value} value={option.value}>
											{option.label}
										</option>
									))}
								</select>
							</div>
							<div className="text-xs text-muted-foreground">
								{t("client:paymentPage.reservation.messages.peopleRange", {
									min: Number(screen.payload.numberOfPeople.min),
									max: Number(screen.payload.numberOfPeople.max),
								})}
							</div>
						</div>

						<div className="space-y-2">
							<label
								className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"
								htmlFor={slotFieldId}
							>
								{t("client:paymentPage.reservation.fields.slot")}
							</label>
							<select
								id={slotFieldId}
								className="w-full rounded-md border bg-background px-3 py-2 text-sm"
								value={selectedSlotId ?? ""}
								onChange={(event) =>
									setSelectedSlotId(event.target.value || null)
								}
								disabled={filteredSlots.length === 0}
							>
								{filteredSlots.length === 0 ? (
									<option value="">
										{t(
											"client:paymentPage.reservation.messages.noSlotForSelection",
										)}
									</option>
								) : (
									filteredSlots.map((slot) => (
										<option key={slot.id} value={slot.id}>
											{formatTime(slot.startAt)}-{formatTime(slot.endAt)}
											{slot.minNumberOfPeople || slot.maxNumberOfPeople
												? ` • ${t(
														"client:paymentPage.reservation.labels.slotPeopleRange",
														{
															min: slot.minNumberOfPeople
																? Number(slot.minNumberOfPeople)
																: Number(screen.payload.numberOfPeople.min),
															max: slot.maxNumberOfPeople
																? Number(slot.maxNumberOfPeople)
																: Number(screen.payload.numberOfPeople.max),
														},
													)}`
												: ""}
										</option>
									))
								)}
							</select>
						</div>

						{isEmailRequired && (
							<div className="space-y-2">
								<label
									className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"
									htmlFor={emailFieldId}
								>
									{t("client:paymentPage.reservation.fields.email")}
								</label>
								<Input
									id={emailFieldId}
									type="email"
									value={email}
									onChange={(event) => setEmail(event.target.value)}
									placeholder={t(
										"client:paymentPage.reservation.placeholders.email",
									)}
								/>
							</div>
						)}

						{isPhoneRequired && (
							<div className="space-y-2">
								<label
									className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"
									htmlFor={phoneFieldId}
								>
									{t("client:paymentPage.reservation.fields.phone")}
								</label>
								<Input
									id={phoneFieldId}
									type="tel"
									value={phone}
									onChange={(event) => setPhone(event.target.value)}
									placeholder={t(
										"client:paymentPage.reservation.placeholders.phone",
									)}
								/>
							</div>
						)}

						{screen.payload.note.enabled && (
							<div className="space-y-2">
								<label
									className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"
									htmlFor={noteFieldId}
								>
									{t("client:paymentPage.reservation.fields.note")}
								</label>
								<Textarea
									id={noteFieldId}
									value={note}
									onChange={(event) => setNote(event.target.value)}
									maxLength={
										screen.payload.note.maxLength !== undefined
											? Number(screen.payload.note.maxLength)
											: undefined
									}
									placeholder={t(
										"client:paymentPage.reservation.placeholders.note",
									)}
									className="min-h-24"
								/>
								{screen.payload.note.maxLength !== undefined && (
									<div className="text-xs text-muted-foreground text-right">
										{note.length}/{Number(screen.payload.note.maxLength)}
									</div>
								)}
							</div>
						)}

						<Button
							type="button"
							size="lg"
							className="w-full"
							disabled={!canSubmit}
							onClick={() => {
								// Submit wiring will be added later.
							}}
						>
							{t("client:paymentPage.reservation.actions.submit")}
						</Button>
					</div>
				</div>

				<div className="rounded-xl border bg-muted/30 px-4 py-3">
					<div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
						{t("client:paymentPage.reservation.summary.generatedAt")}
					</div>
					<div className="mt-1 text-sm font-medium leading-tight text-foreground">
						{formatDateTime(screen.payload.generatedAt)}
					</div>
					<div className="mt-0.5 text-xs text-muted-foreground">{timezone}</div>
					<div className="mt-2 text-xs text-muted-foreground">
						{t("client:paymentPage.reservation.summary.contactRequirements", {
							emailRequirement: isEmailRequired
								? t("client:paymentPage.reservation.labels.required")
								: t("client:paymentPage.reservation.labels.optional"),
							phoneRequirement: isPhoneRequired
								? t("client:paymentPage.reservation.labels.required")
								: t("client:paymentPage.reservation.labels.optional"),
						})}
					</div>
					{screen.payload.note.enabled && (
						<div className="mt-1 text-xs text-muted-foreground">
							{screen.payload.note.maxLength !== undefined
								? t(
										"client:paymentPage.reservation.summary.noteEnabledWithMax",
										{
											max: Number(screen.payload.note.maxLength),
										},
									)
								: t("client:paymentPage.reservation.summary.noteEnabled")}
						</div>
					)}
				</div>
			</div>
		</div>
	);
};
