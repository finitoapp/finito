"use client";

import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setAppLanguage } from "@/lib/i18n/client";

export function LanguageToggle() {
	const { t, i18n } = useTranslation();
	const currentLanguage = (
		i18n.resolvedLanguage ??
		i18n.language ??
		"en"
	).startsWith("cs")
		? "cs"
		: "en";

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						variant="outline"
						className="relative h-8 w-8 rounded-full bg-card shadow-lg hover:bg-accent"
					/>
				}
			>
				<Languages className="h-[1.2rem] w-[1.2rem]" />
				<span className="sr-only">
					{t("components:languageToggle.toggleLanguage")}
				</span>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuItem
					onClick={() => void setAppLanguage("en")}
					className={currentLanguage === "en" ? "font-semibold" : undefined}
				>
					{t("components:languageToggle.english")}
				</DropdownMenuItem>
				<DropdownMenuItem
					onClick={() => void setAppLanguage("cs")}
					className={currentLanguage === "cs" ? "font-semibold" : undefined}
				>
					{t("components:languageToggle.czech")}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
