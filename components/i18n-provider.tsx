"use client";

import { useEffect, useState } from "react";
import { I18nextProvider } from "react-i18next";
import { ensureClientLanguage, i18next } from "@/lib/i18n/client";

export function I18nProvider({ children }: { children: React.ReactNode }) {
	const [language, setLanguage] = useState(() => ensureClientLanguage());

	useEffect(() => {
		const handleLanguageChanged = (nextLanguage: string) => {
			setLanguage(nextLanguage);
		};

		i18next.on("languageChanged", handleLanguageChanged);
		ensureClientLanguage();

		return () => {
			i18next.off("languageChanged", handleLanguageChanged);
		};
	}, []);

	return (
		<I18nextProvider i18n={i18next}>
			<div key={language} className="contents">
				{children}
			</div>
		</I18nextProvider>
	);
}
