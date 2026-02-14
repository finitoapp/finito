"use client";

import { useTranslation } from "react-i18next";

export default function Page() {
	const { t } = useTranslation();
	return (
		<div className="space-y-8 w-full">
			<div className="text-center">
				<h2 className="text-2xl font-bold text-gray-900 mb-2">{t("client:home.title")}</h2>
				<p className="text-gray-600">{t("client:home.scanHint")}</p>
			</div>
		</div>
	);
}
