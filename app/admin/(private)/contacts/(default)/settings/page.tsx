"use client";

import { useTranslation } from "react-i18next";
import { SubNavShellContent } from "@/components/sub-nav-shell";

export default function Page() {
	const { t } = useTranslation();

	return (
		<SubNavShellContent title={t("navigation:main.settings")}>
			<div />
		</SubNavShellContent>
	);
}
