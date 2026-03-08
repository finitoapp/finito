"use client";

import { useEffect, useRef } from "react";

export const useCurrentTimeScroll = (params: {
	showCurrentTimeLine: boolean;
	currentTimeLineLeftPercent: number;
	timelineScrollerRef: React.RefObject<HTMLDivElement | null>;
	scrollKey: string;
}) => {
	const {
		currentTimeLineLeftPercent,
		showCurrentTimeLine,
		scrollKey,
		timelineScrollerRef,
	} = params;
	const didAutoScrollRef = useRef(false);
	const previousScrollKeyRef = useRef<string | null>(null);

	useEffect(() => {
		if (previousScrollKeyRef.current === scrollKey) return;
		previousScrollKeyRef.current = scrollKey;
		didAutoScrollRef.current = false;
	}, [scrollKey]);

	useEffect(() => {
		if (!showCurrentTimeLine) return;
		if (didAutoScrollRef.current) return;
		const scroller = timelineScrollerRef.current;
		if (scroller === null) return;

		const alignRatio = 0.22;
		const currentTimeX =
			(currentTimeLineLeftPercent / 100) * scroller.scrollWidth;
		const targetScrollLeft = Math.max(
			0,
			currentTimeX - scroller.clientWidth * alignRatio,
		);
		scroller.scrollLeft = Math.min(
			targetScrollLeft,
			Math.max(0, scroller.scrollWidth - scroller.clientWidth),
		);
		didAutoScrollRef.current = true;
	}, [currentTimeLineLeftPercent, showCurrentTimeLine, timelineScrollerRef]);
};
