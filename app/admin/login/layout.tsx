"use client";


import { useTranslation } from "react-i18next";
import Image from "next/image";
import { FinitoLogo } from "@/components/finito-logo";
import { ResponsiveCard } from "@/components/responsive-card";
import { CardContent } from "@/components/ui/card";

export default function Layout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const { t } = useTranslation();
	return (
		<div className="bg-muted flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
			<div className="w-full max-w-sm md:max-w-3xl">
				<div className={"flex flex-col gap-6"}>
					<ResponsiveCard className="overflow-hidden p-0">
						<CardContent className="grid p-0 md:grid-cols-2">
							<div className="p-6 md:p-8">
								<div className="flex flex-col gap-6">
									<div className="flex flex-col items-center text-center">
										<h1 className="text-2xl font-bold flex">
											Welcome to <FinitoLogo className={"ml-4"} />
										</h1>
									</div>

									{children}
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
						</CardContent>
					</ResponsiveCard>
					<div className="text-muted-foreground *:[a]:hover:text-primary text-center text-xs text-balance *:[a]:underline *:[a]:underline-offset-4">
						By clicking continue, you agree to our{" "}
						<a href="#def">{t("auth:legal.termsOfService")}</a> and{" "}
						<a href="#abc">{t("auth:legal.privacyPolicy")}</a>.
					</div>
				</div>
			</div>
		</div>
	);
}
