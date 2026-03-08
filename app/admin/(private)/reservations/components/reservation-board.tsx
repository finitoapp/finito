"use client";

import { addDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ReservationControls } from "@/app/admin/(private)/reservations/components/reservation-controls";
import { ReservationDataSync } from "@/app/admin/(private)/reservations/components/reservation-data-sync";
import { ReservationEditorDialog } from "@/app/admin/(private)/reservations/components/reservation-editor-dialog";
import { ReservationSidebar } from "@/app/admin/(private)/reservations/components/reservation-sidebar";
import { ReservationTableDialog } from "@/app/admin/(private)/reservations/components/reservation-table-dialog";
import { ReservationTimeline } from "@/app/admin/(private)/reservations/components/reservation-timeline";
import { ReservationWarnings } from "@/app/admin/(private)/reservations/components/reservation-warnings";
import type { ReservationStateAtoms } from "@/app/admin/(private)/reservations/lib/state-atoms";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Calendar } from "@/components/ui/calendar";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardHeading,
	CardTitle,
	CardToolbar,
} from "@/components/ui/card";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";

export const ReservationBoard: React.FC<{
	stateAtoms: ReservationStateAtoms;
}> = (props) => {
	const { t } = useTranslation();
	const [selectedDay, setSelectedDay] = useAtom(
		props.stateAtoms.selectedDayAtom,
	);
	const dayRange = useAtomValue(props.stateAtoms.dayRangeAtom);
	const timezone = useAtomValue(props.stateAtoms.timezoneAtom);
	const openCreateDialog = useSetAtom(props.stateAtoms.openCreateDialogAtom);

	return (
		<>
			<ReservationDataSync stateAtoms={props.stateAtoms} />
			<Card>
				<CardHeader className={"py-6"}>
					<CardHeading>
						<CardTitle>{t("reservations:page.calendar.title")}</CardTitle>
						<CardDescription>
							{t("reservations:page.calendar.description")}
						</CardDescription>
					</CardHeading>
					<CardToolbar>
						<ButtonGroup>
							<Button
								variant="outline"
								onClick={() => setSelectedDay((day) => addDays(day, -1))}
							>
								<ChevronLeftIcon />
								{t("reservations:page.actions.previousDay")}
							</Button>
							<Popover>
								<PopoverTrigger asChild>
									<Button variant="outline">
										{formatInTimeZone(selectedDay, timezone, "dd.MM.yyyy")}
									</Button>
								</PopoverTrigger>
								<PopoverContent className="w-auto p-0" align="start">
									<Calendar
										mode="single"
										selected={selectedDay}
										onSelect={(date) => {
											if (date !== undefined) {
												setSelectedDay(date);
											}
										}}
									/>
								</PopoverContent>
							</Popover>
							<Button
								variant="outline"
								onClick={() => setSelectedDay((day) => addDays(day, 1))}
							>
								{t("reservations:page.actions.nextDay")}
								<ChevronRightIcon />
							</Button>
						</ButtonGroup>
						<Button
							onClick={() =>
								openCreateDialog({
									tableId: null,
									startAt: dayRange.openMs,
								})
							}
						>
							<PlusIcon />
							{t("reservations:page.actions.newReservation")}
						</Button>
					</CardToolbar>
				</CardHeader>
				<CardContent>
					<ReservationWarnings stateAtoms={props.stateAtoms} />
					<ReservationControls stateAtoms={props.stateAtoms} />

					<div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
						<ReservationTimeline stateAtoms={props.stateAtoms} />
						<ReservationSidebar stateAtoms={props.stateAtoms} />
					</div>
				</CardContent>
			</Card>
			<ReservationEditorDialog stateAtoms={props.stateAtoms} />
			<ReservationTableDialog stateAtoms={props.stateAtoms} />
		</>
	);
};
