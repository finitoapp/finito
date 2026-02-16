"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { useEffect } from "react";
import { useReservationsData } from "@/app/admin/(private)/reservations/hooks/use-reservations-data";
import type { ReservationStateAtoms } from "@/app/admin/(private)/reservations/lib/state-atoms";

export const ReservationDataSync: React.FC<{
	stateAtoms: ReservationStateAtoms;
}> = (props) => {
	const selectedDay = useAtomValue(props.stateAtoms.selectedDayAtom);
	const syncData = useSetAtom(props.stateAtoms.syncDataAtom);
	const { timezone, dayRange, tables, reservations } = useReservationsData({
		selectedDay,
	});

	useEffect(() => {
		syncData({ timezone, dayRange, tables, reservations });
	}, [syncData, timezone, dayRange, tables, reservations]);

	return null;
};
