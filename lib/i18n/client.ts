import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import {
	DEFAULT_LANGUAGE,
	I18N_DEFAULT_NAMESPACE,
	I18N_NAMESPACES,
	SUPPORTED_LANGUAGES,
} from "@/lib/i18n/config";
import { resources } from "@/lib/i18n/resources";

const readLanguageFromStorage = () => {
	if (typeof window === "undefined") {
		return DEFAULT_LANGUAGE;
	}

	const storedLanguage = window.localStorage.getItem("finito:language");
	if (storedLanguage && SUPPORTED_LANGUAGES.includes(storedLanguage as (typeof SUPPORTED_LANGUAGES)[number])) {
		return storedLanguage;
	}

	const browserLanguage = window.navigator.language.toLowerCase();
	if (browserLanguage.startsWith("cs")) {
		return "cs";
	}

	return DEFAULT_LANGUAGE;
};

if (!i18next.isInitialized) {
	void i18next.use(initReactI18next).init({
		resources,
		ns: [...I18N_NAMESPACES],
		defaultNS: I18N_DEFAULT_NAMESPACE,
		lng: DEFAULT_LANGUAGE,
		fallbackLng: DEFAULT_LANGUAGE,
		interpolation: {
			escapeValue: false,
		},
		react: {
			useSuspense: false,
		},
	});
}

export const ensureClientLanguage = () => {
	const language = readLanguageFromStorage();
	if (i18next.language !== language) {
		void i18next.changeLanguage(language);
	}

	return language;
};

export const setAppLanguage = async (language: "en" | "cs") => {
	if (typeof window !== "undefined") {
		window.localStorage.setItem("finito:language", language);
	}
	await i18next.changeLanguage(language);
};

export { i18next };
