"use client"; // Error components must be Client Components

import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

function isSharedWorkerUnsupportedError(error: Error & { cause?: unknown }) {
	const candidateValues = [
		error.message,
		error.name,
		error.cause instanceof Error ? error.cause.message : null,
		typeof error.cause === "string" ? error.cause : null,
	]
		.filter(Boolean)
		.join(" ")
		.toLowerCase();

	return (
		candidateValues.includes("sharedworker") &&
		(candidateValues.includes("not defined") ||
			candidateValues.includes("not supported") ||
			candidateValues.includes("unsupported") ||
			candidateValues.includes("is not a constructor") ||
			candidateValues.includes("not available"))
	);
}

export default function ErrorPage({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	const { t } = useTranslation();
	const isSharedWorkerUnsupported = isSharedWorkerUnsupportedError(error);

	useEffect(() => {
		console.error(error);
	}, [error]);

	return (
		<div className="bg-background flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
			<Card className="w-full max-w-xl">
				<CardHeader className="space-y-2">
					<CardTitle>
						{isSharedWorkerUnsupported
							? t("app:error.sharedWorkerUnsupported.title")
							: t("app:error.generic.title")}
					</CardTitle>
					<CardDescription>
						{isSharedWorkerUnsupported
							? t("app:error.sharedWorkerUnsupported.description")
							: t("app:error.generic.description")}
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="rounded-lg border border-border/60 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
						{error.message}
					</div>
				</CardContent>
				{!isSharedWorkerUnsupported ? (
					<CardFooter>
						<Button type={"button"} onClick={() => reset()}>
							{t("common:actions.retry")}
						</Button>
					</CardFooter>
				) : null}
			</Card>
		</div>
	);
}
