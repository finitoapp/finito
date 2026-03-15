"use client";

import {
	IconBrandGithub,
	IconBrandX,
	IconPlugConnected,
	IconUserCircle,
} from "@tabler/icons-react";
import {
	HardDriveDownloadIcon,
	KeyRoundIcon,
	LanguagesIcon,
	LayoutDashboardIcon,
	RefreshCcwIcon,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { type ComponentProps, useEffect, useEffectEvent, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { VerticalNav } from "@/app/(client)/settings/vertial-nav";
import { FadeHeader } from "@/components/fade-header";
import { LanguageToggle } from "@/components/language-toggle";
import { ModeToggle } from "@/components/mode-toggle";
import { useInstallPwa } from "@/hooks/use-install-pwa";

const createWalletItems = (
	t: (key: string) => string,
): ComponentProps<typeof VerticalNav>["items"] => [
	{
		label: t("settings:page.navigation.connectedWallets"),
		nextLink: "/settings/wallets",
		icon: <IconPlugConnected className="h-4 w-4" />,
	},
];
const createNavigationItems = (
	t: (key: string) => string,
): ComponentProps<typeof VerticalNav>["items"] => [
	{
		label: t("settings:page.navigation.account"),
		nextLink: "/settings/account",
		icon: <IconUserCircle className="h-4 w-4" />,
	},
	{
		label: t("settings:page.navigation.credentials"),
		nextLink: "/settings/credentials",
		icon: <KeyRoundIcon className="h-4 w-4" />,
	},
	{
		label: t("settings:page.navigation.theme"),
		icon: <LayoutDashboardIcon className="h-4 w-4" />,
		action: (
			<div className={"-my-4 -mr-2"}>
				<ModeToggle />
			</div>
		),
	},
	{
		label: t("settings:page.navigation.language"),
		icon: <LanguagesIcon className="h-4 w-4" />,
		action: (
			<div className={"-my-4 -mr-2"}>
				<LanguageToggle />
			</div>
		),
	},
];
const createSecondaryNavigationItems = (
	t: (key: string) => string,
): ComponentProps<typeof VerticalNav>["items"] => [
	{
		label: t("settings:page.navigation.switchAccount"),
		nextLink: "/settings/switch-account",
		icon: <RefreshCcwIcon className="h-4 w-4" />,
	},
];
const navigationPluginsItems: ComponentProps<typeof VerticalNav>["items"] = [];
const createNavigationLinkItems = (
	t: (key: string) => string,
): ComponentProps<typeof VerticalNav>["items"] => [
	{
		label: t("settings:page.links.followUsOnX"),
		component: (props) => (
			<a
				{...props}
				target={"_blank"}
				rel="noopener"
				href={"https://x.com/finito_app"}
			>
				{props.children}
			</a>
		),
		icon: <IconBrandX className="h-4 w-4" />,
	},
	{
		label: t("settings:page.links.checkCodeOnGitHub"),
		component: (props) => (
			<a
				{...props}
				target={"_blank"}
				rel="noopener"
				href={"https://github.com/finitoapp/finito"}
			>
				{props.children}
			</a>
		),
		icon: <IconBrandGithub className="h-4 w-4" />,
	},
];

const InstallPWA = () => {
	const { t } = useTranslation();
	const { isPwaSupported, onClick } = useInstallPwa();
	const searchParams = useSearchParams();

	const installAutomatically = useEffectEvent(() => {
		if (searchParams.get("install") === "true") {
			onClick();
		}
	});

	useEffect(() => {
		if (!isPwaSupported) {
			return;
		}

		installAutomatically();
	}, [isPwaSupported]);

	if (!isPwaSupported) {
		return null;
	}

	return (
		<VerticalNav
			items={[
				{
					label: t("settings:page.install"),
					onClick: () => onClick(),
					icon: <HardDriveDownloadIcon className="h-4 w-4" />,
				},
			]}
		/>
	);
};

export default function Page() {
	const { t } = useTranslation();
	const commitHash =
		process.env.NEXT_PUBLIC_GIT_COMMIT || t("settings:page.unknown");
	const router = useRouter();
	const walletItems = useMemo(() => createWalletItems(t), [t]);
	const navigationItems = useMemo(() => createNavigationItems(t), [t]);
	const navigationItems3 = useMemo(
		() => createSecondaryNavigationItems(t),
		[t],
	);
	const navigationLinkItems = useMemo(() => createNavigationLinkItems(t), [t]);

	useEffect(() => {
		for (const item of [
			...navigationItems,
			...navigationPluginsItems,
			...navigationItems3,
		]) {
			if (item.nextLink !== undefined) {
				router.prefetch(item.nextLink);
			}
		}
	}, [router, navigationItems, navigationItems3]);

	return (
		<div className="space-y-8 w-full px-4">
			<div className={"h-8"} />
			<FadeHeader title={t("settings:page.settings")} />

			<VerticalNav items={walletItems} />
			<VerticalNav items={navigationItems} />
			{navigationPluginsItems.length > 0 && (
				<VerticalNav
					title={t("settings:page.plugins")}
					items={navigationPluginsItems}
				/>
			)}
			<VerticalNav items={navigationItems3} />
			<InstallPWA />

			<VerticalNav
				title={t("settings:page.externalLinks")}
				items={navigationLinkItems}
			/>

			<div className={"text-center text-sm"}>
				{t("settings:page.appVersion")}: <strong>{commitHash}</strong>
			</div>

			<div className={"text-center text-sm"}>
				{t("settings:page.weAreOpensource")}
			</div>
		</div>
	);
}
