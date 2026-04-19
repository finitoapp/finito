"use client";

import { useTranslation } from "react-i18next";
import { SubNavShellContent } from "@/components/sub-nav-shell";
import { StorageDebugSection } from "../debug-sections";

export default function Home() {
	const { t } = useTranslation();

	return (
		<SubNavShellContent title={t("admin:dashboard.storageData")}>
			<StorageDebugSection />
		</SubNavShellContent>
	);
}
