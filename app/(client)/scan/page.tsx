"use client";

import { Scanner } from "@yudiel/react-qr-scanner";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { FadeHeader } from "@/components/fade-header";
import { Button } from "@/components/ui/button";

export default function Page() {
	const { t } = useTranslation();
	const router = useRouter();

	return (
		<div className="flex-1 flex flex-col px-8 justify-evenly gap-4">
			<div className={"h-10"} />
			<FadeHeader title={t("client:page.scanQrCode")} />

			<div className="text-center">
				<p className="text-muted-foreground">{t("client:home.scanHint")}</p>
			</div>

			<div className="flex flex-col bg-black rounded-2xl overflow-hidden relative">
				<Scanner
					styles={{
						container: {
							aspectRatio: "3/4",
							height: "100%",
						},
					}}
					formats={["qr_code"]}
					onScan={(result) => {
						router.push(`/#${encodeURIComponent(result[0].rawValue)}`);
					}}
					sound={false}
					components={{
						torch: true,
					}}
				/>
			</div>

			<div className={"flex justify-center"}>
				<Button
					variant={"secondary"}
					onClick={() => {
						// window.location = window.location + "#example-1";
						router.push(`/#example-1`);
					}}
				>
					{t("client:page.useExample")}
				</Button>
			</div>
		</div>
	);
}
