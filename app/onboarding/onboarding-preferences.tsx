"use client";

import { useTheme } from "next-themes";
import { useTranslation } from "react-i18next";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { setAppLanguage } from "@/lib/i18n/client";

type AppLanguage = "cs" | "en";
type UiTheme = "dark" | "light";

export const OnboardingPreferences = () => {
	const { t, i18n } = useTranslation();
	const { theme, resolvedTheme, setTheme } = useTheme();

	const currentLanguage: AppLanguage = (
		i18n.resolvedLanguage ??
		i18n.language ??
		"en"
	).startsWith("cs")
		? "cs"
		: "en";

	const currentTheme: UiTheme =
		theme === "dark" || theme === "light"
			? theme
			: resolvedTheme === "dark"
				? "dark"
				: "light";

	return (
		<div className="text-muted-foreground flex items-center justify-end gap-2 text-xs whitespace-nowrap">
			<Select
				value={currentLanguage}
				onValueChange={(value) => void setAppLanguage(value as AppLanguage)}
			>
				<SelectTrigger
					size={"sm"}
					className={"text-xs border-0 bg-transparent! p-0"}
				>
					<span>{t("components:onboardingPreferences.language")}:</span>
					<SelectValue className={"underline"} />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="en">
						{t("components:languageToggle.english")}
					</SelectItem>
					<SelectItem value="cs">
						{t("components:languageToggle.czech")}
					</SelectItem>
				</SelectContent>
			</Select>
			<Separator orientation={"vertical"} />
			<Select
				value={currentTheme}
				onValueChange={(value) => setTheme(value as UiTheme)}
			>
				<SelectTrigger
					size={"sm"}
					className={"text-xs border-0 bg-transparent! p-0"}
				>
					<span>{t("components:onboardingPreferences.theme")}:</span>
					<SelectValue className={"underline"} />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="light">
						{t("components:themeToggle.light")}
					</SelectItem>
					<SelectItem value="dark">
						{t("components:themeToggle.dark")}
					</SelectItem>
				</SelectContent>
			</Select>
		</div>
	);
};
