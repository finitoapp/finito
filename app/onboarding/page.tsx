"use client";

import { PlusIcon, RotateCcwIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { getSafeReturnTo, withReturnTo } from "@/app/onboarding/utils";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function Page() {
	const { t } = useTranslation();
	const router = useRouter();
	const searchParams = useSearchParams();
	const returnTo = getSafeReturnTo(searchParams.get("returnTo"));

	return (
		<Card>
			<CardHeader className="space-y-2">
				<CardTitle>{t("app:onboarding.title")}</CardTitle>
				<CardDescription>{t("app:onboarding.description")}</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-3">
				<Button
					type="button"
					className="h-auto justify-start gap-4 whitespace-normal py-4"
					onClick={() => {
						router.push(withReturnTo("/onboarding/new", returnTo) as never);
					}}
				>
					<span className="bg-primary-foreground/15 flex size-10 shrink-0 items-center justify-center rounded-md">
						<PlusIcon className="size-6" />
					</span>
					<div className="min-w-0 grid grow text-left leading-snug">
						<span className="font-medium">
							{t("app:onboarding.options.new.title")}
						</span>
						<span className="text-primary-foreground/80">
							{t("app:onboarding.options.new.description")}
						</span>
					</div>
				</Button>

				<Separator />

				<Button
					type="button"
					variant="outline"
					className="h-auto justify-start gap-4 whitespace-normal py-4"
					onClick={() => {
						router.push(withReturnTo("/onboarding/restore", returnTo) as never);
					}}
				>
					<span className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-md">
						<RotateCcwIcon className="size-6" />
					</span>
					<div className="min-w-0 grid grow text-left leading-snug">
						<span className="font-medium">
							{t("app:onboarding.options.restore.title")}
						</span>
						<span className="text-muted-foreground">
							{t("app:onboarding.options.restore.description")}
						</span>
					</div>
				</Button>
			</CardContent>
		</Card>
	);
}
