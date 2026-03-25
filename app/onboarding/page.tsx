"use client";

import { PlusIcon, RotateCcwIcon } from "lucide-react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { getSafeReturnTo, withReturnTo } from "@/app/onboarding/utils";
import { FinitoLogo } from "@/components/finito-logo";
import { Button } from "@/components/ui/button";
import { CardDescription, CardTitle } from "@/components/ui/card";

export default function Page() {
	const { t } = useTranslation();
	const router = useRouter();
	const searchParams = useSearchParams();
	const returnTo = getSafeReturnTo(searchParams.get("returnTo"));

	return (
		<div className="grid p-0 md:grid-cols-2">
			<div className="grid gap-12 p-4 md:p-6">
				<div className={"flex flex-col gap-10"}>
					<h1 className="text-2xl font-bold flex justify-center py-4">
						{t("app:onboarding.welcome")} <FinitoLogo className={"ml-4"} />
					</h1>
					<CardTitle>{t("app:onboarding.title")}</CardTitle>
					<CardDescription>{t("app:onboarding.description")}</CardDescription>
				</div>

				<div className={"flex flex-col gap-6"}>
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

					<Button
						type="button"
						variant="outline"
						className="h-auto justify-start gap-4 whitespace-normal py-4"
						onClick={() => {
							router.push(
								withReturnTo("/onboarding/restore", returnTo) as never,
							);
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
				</div>
			</div>

			<div className="bg-muted relative hidden md:block">
				<Image
					src="/pexels-photo-220067.jpeg"
					alt={t("auth:layout.imageAlt")}
					className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
					width={1024}
					height={768}
				/>
			</div>
		</div>
	);
}
