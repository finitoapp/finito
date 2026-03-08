"use client"; // Error components must be Client Components

import { useEffect } from "react";
import { useTranslation } from "react-i18next";

export default function ErrorPage({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	const { t } = useTranslation();
	useEffect(() => {
		// Log the error to an error reporting service
		console.error(error);
	}, [error]);

	return (
		<div>
			<h2>{t("app:error.generic")}</h2>
			<button
				type={"button"}
				onClick={
					// Attempt to recover by trying to re-render the segment
					() => reset()
				}
			>
				{t("common:actions.retry")}
			</button>
		</div>
	);
}
