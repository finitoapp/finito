"use client";

import { useState } from "react";
import { ReservationBoard } from "@/app/admin/(private)/reservations/components/reservation-board";
import { createReservationStateAtoms } from "@/app/admin/(private)/reservations/lib/state-atoms";

export const ReservationRoot: React.FC = () => {
	const [stateAtoms] = useState(createReservationStateAtoms);

	return <ReservationBoard stateAtoms={stateAtoms} />;
};
