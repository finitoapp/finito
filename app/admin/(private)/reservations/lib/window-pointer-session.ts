"use client";

export const withWindowPointerSession = (handlers: {
	onPointerMove?: (event: PointerEvent) => void;
	onPointerUp?: (event: PointerEvent) => void;
	onPointerCancel?: (event: PointerEvent) => void;
}) => {
	const handlePointerMove = (event: PointerEvent) => {
		handlers.onPointerMove?.(event);
	};
	const handlePointerUp = (event: PointerEvent) => {
		handlers.onPointerUp?.(event);
	};
	const handlePointerCancel = (event: PointerEvent) => {
		handlers.onPointerCancel?.(event);
	};

	window.addEventListener("pointermove", handlePointerMove);
	window.addEventListener("pointerup", handlePointerUp);
	window.addEventListener("pointercancel", handlePointerCancel);

	return () => {
		window.removeEventListener("pointermove", handlePointerMove);
		window.removeEventListener("pointerup", handlePointerUp);
		window.removeEventListener("pointercancel", handlePointerCancel);
	};
};
