import { useEffect, useState } from "react";

interface IBeforeInstallPromptEvent extends Event {
	readonly platforms: string[];
	readonly userChoice: Promise<{
		outcome: "accepted" | "dismissed";
		platform: string;
	}>;
	prompt(): Promise<void>;
}

export const useInstallPwa = () => {
	const [prompt, setState] = useState<IBeforeInstallPromptEvent | null>(null);

	useEffect(() => {
		const handler = (e: IBeforeInstallPromptEvent) => {
			e.preventDefault();
			setState(e);
		};
		window.addEventListener(
			"beforeinstallprompt",
			// @ts-expect-error
			handler,
		);

		return () => {
			window.removeEventListener(
				"beforeinstallprompt",
				// @ts-expect-error
				handler,
			);
		};
	}, []);

	const onClick = () => {
		if (!prompt) {
			return;
		}

		prompt.prompt();
	};

	return {
		isPwaSupported: prompt !== null,
		onClick,
	};
};
