import type { Id } from "@evolu/common";
import { useSetAtom } from "jotai";
import type React from "react";
import { useRef } from "react";
import { createLongPressTracker } from "@/app/admin/(private)/reservations/lib/long-press-tracker";
import type { ReservationStateAtoms } from "@/app/admin/(private)/reservations/lib/state-atoms";
import { withWindowPointerSession } from "@/app/admin/(private)/reservations/lib/window-pointer-session";

const LONG_PRESS_MS = 2000;
const LONG_PRESS_CANCEL_DRAG_THRESHOLD_PX = 4;

export const useSlotSelection = (params: {
	stateAtoms: ReservationStateAtoms;
	suppressClickUntilRef: React.RefObject<number>;
	panBlockedRef: React.MutableRefObject<boolean>;
	dayOpenMs: number;
	slotMs: number;
	slotCount: number;
	slotMinutes: number;
	onCreateReservation: (value: {
		tableId: Id;
		startAt: number;
		durationMinutes: number;
	}) => void;
}) => {
	const setSlotSelectionPreview = useSetAtom(
		params.stateAtoms.slotSelectionPreviewAtom,
	);
	const setLongPressPreview = useSetAtom(
		params.stateAtoms.longPressPreviewAtom,
	);

	const slotDragSelectionRef = useRef<{
		active: boolean;
		tableId: Id;
		startSlotIndex: number;
		currentSlotIndex: number;
		startClientX: number;
		activated: boolean;
	} | null>(null);
	const cleanupSessionRef = useRef<(() => void) | null>(null);
	const longPressStopRef = useRef<(() => void) | null>(null);

	const resetState = () => {
		longPressStopRef.current?.();
		longPressStopRef.current = null;
		cleanupSessionRef.current?.();
		cleanupSessionRef.current = null;
		slotDragSelectionRef.current = null;
		params.panBlockedRef.current = false;
		setLongPressPreview(null);
		setSlotSelectionPreview(null);
	};

	const onSlotPointerDown = (
		event: React.PointerEvent<HTMLButtonElement>,
		args: { tableId: Id; slotIndex: number },
	) => {
		if (event.button !== 0) return;
		if (performance.now() < (params.suppressClickUntilRef.current ?? 0)) return;

		params.panBlockedRef.current = true;
		const slotWidthPx = event.currentTarget.getBoundingClientRect().width;
		slotDragSelectionRef.current = {
			active: true,
			tableId: args.tableId,
			startSlotIndex: args.slotIndex,
			currentSlotIndex: args.slotIndex,
			startClientX: event.clientX,
			activated: false,
		};
		longPressStopRef.current?.();
		const longPress = createLongPressTracker({
			durationMs: LONG_PRESS_MS,
			moveThresholdPx: LONG_PRESS_CANCEL_DRAG_THRESHOLD_PX,
			startClientX: event.clientX,
			startClientY: event.clientY,
			onProgress: (progress) => {
				const current = slotDragSelectionRef.current;
				if (current === null || progress === null) {
					setLongPressPreview(null);
					return;
				}
				setLongPressPreview({
					tableId: current.tableId,
					slotIndex: current.startSlotIndex,
					progress,
				});
			},
			onTriggered: () => {
				const current = slotDragSelectionRef.current;
				if (current === null || !current.active || current.activated) return;
				current.activated = true;
				setSlotSelectionPreview({
					tableId: current.tableId,
					startSlotIndex: current.startSlotIndex,
					endSlotIndex: current.startSlotIndex,
				});
			},
			onCanceled: () => {
				resetState();
			},
		});
		longPressStopRef.current = () => longPress.stop("done");

		const onPointerMove = (pointerEvent: PointerEvent) => {
			const state = slotDragSelectionRef.current;
			if (!state || !state.active) return;
			longPress.onPointerMove(pointerEvent);

			if (!state.activated) {
				return;
			}

			const deltaSlots = Math.round(
				(pointerEvent.clientX - state.startClientX) / slotWidthPx,
			);
			const slotIndex = Math.max(
				0,
				Math.min(params.slotCount - 1, state.startSlotIndex + deltaSlots),
			);

			state.currentSlotIndex = slotIndex;
			setSlotSelectionPreview({
				tableId: state.tableId,
				startSlotIndex: Math.min(state.startSlotIndex, slotIndex),
				endSlotIndex: Math.max(state.startSlotIndex, slotIndex),
			});
		};

		const onPointerUp = () => {
			const state = slotDragSelectionRef.current;
			if (!state || !state.active) {
				resetState();
				return;
			}

			const shouldCreate = state.activated;
			const tableId = state.tableId;
			const startSlotIndex = state.startSlotIndex;
			const currentSlotIndex = state.currentSlotIndex;
			resetState();

			if (!shouldCreate) return;

			const startSlot = Math.min(startSlotIndex, currentSlotIndex);
			const endSlot = Math.max(startSlotIndex, currentSlotIndex);
			const durationSlots = endSlot - startSlot + 1;
			const durationMinutes = durationSlots * params.slotMinutes;
			params.suppressClickUntilRef.current = performance.now() + 150;
			params.onCreateReservation({
				tableId,
				startAt: params.dayOpenMs + startSlot * params.slotMs,
				durationMinutes,
			});
		};

		const onPointerCancel = () => {
			resetState();
		};

		cleanupSessionRef.current?.();
		cleanupSessionRef.current = withWindowPointerSession({
			onPointerMove,
			onPointerUp,
			onPointerCancel,
		});
	};

	return {
		onSlotPointerDown,
	};
};
