import { z } from "zod";
import { FiatCurrency, Timezone } from "@/lib/shared/types";

const onboardingNewSettingsSessionKey = "finito.onboarding.new.settings";

const onboardingSettingsSchema = z.object({
	accountName: z.string(),
	defaultCurrency: z.enum(FiatCurrency),
	defaultTimezone: z.enum(Timezone),
});

export type OnboardingSettings = z.output<typeof onboardingSettingsSchema>;

export const saveOnboardingSettings = (settings: OnboardingSettings) => {
	if (typeof window === "undefined") {
		return;
	}

	sessionStorage.setItem(
		onboardingNewSettingsSessionKey,
		JSON.stringify(settings),
	);
};

export const loadOnboardingSettings = (): OnboardingSettings | null => {
	if (typeof window === "undefined") {
		return null;
	}

	const raw = sessionStorage.getItem(onboardingNewSettingsSessionKey);
	if (raw === null) {
		return null;
	}

	const parsed = onboardingSettingsSchema.safeParse(JSON.parse(raw));
	if (!parsed.success) {
		return null;
	}

	return parsed.data;
};

export const clearOnboardingSettings = () => {
	if (typeof window === "undefined") {
		return;
	}

	sessionStorage.removeItem(onboardingNewSettingsSessionKey);
};
