import { useCallback, useState } from "react";
import { toast } from "sonner";

type CopyState = "idle" | "success" | "error";

export function useClipboard(timeout = 2000) {
	const [state, setState] = useState<CopyState>("idle");

	const copy = useCallback(
		async (text: string, options: { customMessage?: string } = {}) => {
			try {
				if (!navigator?.clipboard?.writeText) {
					throw new Error("Clipboard API is not supported");
				}

				await navigator.clipboard.writeText(text);
				setState("success");
				toast(options.customMessage ?? "Successfully copied to clipboard!");

				if (timeout > 0) {
					window.setTimeout(() => setState("idle"), timeout);
				}

				return true;
			} catch {
				setState("error");

				if (timeout > 0) {
					window.setTimeout(() => setState("idle"), timeout);
				}

				return false;
			}
		},
		[timeout],
	);

	return {
		copy,
		copied: state === "success",
		error: state === "error",
		state,
	};
}
