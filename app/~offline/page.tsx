"use client";

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

export default function OfflinePage() {
	const { t } = useTranslation();

	return (
		<div className="bg-background flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
			<Card className="w-full max-w-xl">
				<CardHeader className="space-y-2">
					<CardTitle>{t("app:offline.title")}</CardTitle>
					<CardDescription>{t("app:offline.description")}</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="rounded-lg border border-border/60 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
						{t("app:offline.hint")}
					</div>
				</CardContent>
				<CardFooter>
					<Button type="button" onClick={() => window.location.reload()}>
						{t("common:actions.retry")}
					</Button>
				</CardFooter>
			</Card>
		</div>
	);
}
