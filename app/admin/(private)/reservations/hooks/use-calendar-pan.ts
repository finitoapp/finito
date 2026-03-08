"use client";

import type React from "react";
import { useRef, useState } from "react";

export const useCalendarPan = (params: {
	timelineScrollerRef: React.RefObject<HTMLDivElement | null>;
	isPanBlockedRef?: React.RefObject<boolean>;
}) => {
	const suppressClickUntilRef = useRef(0);
	const [isPanning, setIsPanning] = useState(false);
	const panRef = useRef<{
		active: boolean;
		pointerId: number | null;
		startClientX: number;
		startScrollLeft: number;
		moved: boolean;
	}>({
		active: false,
		pointerId: null,
		startClientX: 0,
		startScrollLeft: 0,
		moved: false,
	});

	const onPanPointerDownCapture = (
		event: React.PointerEvent<HTMLDivElement>,
	) => {
		if (event.button !== 0) return;
		const target = event.target as HTMLElement;
		if (target.closest("[data-pan-ignore='true']") !== null) {
			return;
		}

		const scroller = params.timelineScrollerRef.current;
		if (scroller === null) return;

		panRef.current = {
			active: true,
			pointerId: event.pointerId,
			startClientX: event.clientX,
			startScrollLeft: scroller.scrollLeft,
			moved: false,
		};
	};

	const onPanPointerMoveCapture = (
		event: React.PointerEvent<HTMLDivElement>,
	) => {
		const pan = panRef.current;
		if (!pan.active) return;
		if (params.isPanBlockedRef?.current === true) return;

		const scroller = params.timelineScrollerRef.current;
		if (scroller === null) return;

		const deltaX = event.clientX - pan.startClientX;
		if (!pan.moved && Math.abs(deltaX) > 3) {
			pan.moved = true;
			setIsPanning(true);
			if (pan.pointerId !== null) {
				scroller.setPointerCapture(pan.pointerId);
			}
		}
		if (!pan.moved) {
			return;
		}
		scroller.scrollLeft = pan.startScrollLeft - deltaX;
		event.preventDefault();
	};

	const stopPan = (event: React.PointerEvent<HTMLDivElement>) => {
		const pan = panRef.current;
		if (!pan.active) return;

		const scroller = params.timelineScrollerRef.current;
		if (pan.moved && scroller && pan.pointerId !== null) {
			scroller.releasePointerCapture(pan.pointerId);
		}

		if (pan.moved) {
			suppressClickUntilRef.current = performance.now() + 150;
			event.preventDefault();
		}
		panRef.current = {
			active: false,
			pointerId: null,
			startClientX: 0,
			startScrollLeft: 0,
			moved: false,
		};
		if (pan.moved) {
			setIsPanning(false);
		}
	};

	const onPanClickCapture = (event: React.MouseEvent<HTMLDivElement>) => {
		if (performance.now() < suppressClickUntilRef.current) {
			event.preventDefault();
			event.stopPropagation();
		}
	};

	return {
		isPanning,
		suppressClickUntilRef,
		panHandlers: {
			onPointerDownCapture: onPanPointerDownCapture,
			onPointerMoveCapture: onPanPointerMoveCapture,
			onPointerUpCapture: stopPan,
			onPointerCancelCapture: stopPan,
			onClickCapture: onPanClickCapture,
		},
	};
};
