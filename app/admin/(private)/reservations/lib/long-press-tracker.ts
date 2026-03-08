export const createLongPressTracker = (params: {
	durationMs: number;
	moveThresholdPx: number;
	startClientX: number;
	startClientY: number;
	onProgress: (progress: number | null) => void;
	onTriggered: () => void;
	onCanceled?: () => void;
}) => {
	let active = true;
	let triggered = false;
	let timeoutId: number | null = null;
	let rafId: number | null = null;
	const startedAtMs = performance.now();

	const clearTimers = () => {
		if (timeoutId !== null) {
			window.clearTimeout(timeoutId);
			timeoutId = null;
		}
		if (rafId !== null) {
			window.cancelAnimationFrame(rafId);
			rafId = null;
		}
	};

	const stop = (reason: "cancel" | "done" = "done") => {
		if (!active) return;
		active = false;
		clearTimers();
		params.onProgress(null);
		if (!triggered && reason === "cancel") {
			params.onCanceled?.();
		}
	};

	const updateProgress = () => {
		if (!active || triggered) return;
		const elapsed = performance.now() - startedAtMs;
		const progress = Math.min(1, elapsed / params.durationMs);
		params.onProgress(progress);
		if (progress < 1) {
			rafId = window.requestAnimationFrame(updateProgress);
		}
	};

	timeoutId = window.setTimeout(() => {
		if (!active || triggered) return;
		triggered = true;
		clearTimers();
		params.onProgress(null);
		params.onTriggered();
	}, params.durationMs);
	params.onProgress(0);
	rafId = window.requestAnimationFrame(updateProgress);

	const onPointerMove = (event: PointerEvent) => {
		if (!active || triggered) return;
		const deltaX = event.clientX - params.startClientX;
		const deltaY = event.clientY - params.startClientY;
		const distance = Math.hypot(deltaX, deltaY);
		if (distance > params.moveThresholdPx) {
			stop("cancel");
		}
	};

	return {
		onPointerMove,
		stop,
		isTriggered: () => triggered,
	};
};
