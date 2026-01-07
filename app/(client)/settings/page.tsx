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
	LayoutDashboardIcon,
	RefreshCcwIcon,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { type ComponentProps, useEffect, useEffectEvent } from "react";
import { VerticalNav } from "@/app/(client)/settings/vertial-nav";
import { FadeHeader } from "@/components/fade-header";
import { ModeToggle } from "@/components/mode-toggle";
import { useInstallPwa } from "@/hooks/use-install-pwa";

const walletItems: ComponentProps<typeof VerticalNav>["items"] = [
	{
		label: "Connected wallets",
		nextLink: "/settings/wallets",
		icon: <IconPlugConnected className="h-4 w-4" />,
	},
];
const navigationItems: ComponentProps<typeof VerticalNav>["items"] = [
	{
		label: "Account",
		nextLink: "/settings/account",
		icon: <IconUserCircle className="h-4 w-4" />,
	},
	{
		label: "Credentials",
		nextLink: "/settings/credentials",
		icon: <KeyRoundIcon className="h-4 w-4" />,
	},
	{
		label: "Theme",
		icon: <LayoutDashboardIcon className="h-4 w-4" />,
		action: (
			<div className={"-my-4 -mr-2"}>
				<ModeToggle />
			</div>
		),
	},
];
const navigationItems3: ComponentProps<typeof VerticalNav>["items"] = [
	{
		label: "Switch account",
		nextLink: "/settings/switch-account",
		icon: <RefreshCcwIcon className="h-4 w-4" />,
	},
];
const navigationPluginsItems: ComponentProps<typeof VerticalNav>["items"] = [];
const navigationLinkItems: ComponentProps<typeof VerticalNav>["items"] = [
	{
		label: "Follow as on X",
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
		label: "Check out our code on GitHub",
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
					label: "Install",
					onClick: () => onClick(),
					icon: <HardDriveDownloadIcon className="h-4 w-4" />,
				},
			]}
		/>
	);
};

export default function Page() {
	const commitHash = process.env.NEXT_PUBLIC_GIT_COMMIT || "unknown";
	const router = useRouter();

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
	}, [router]);

	return (
		<div className="space-y-8 w-full px-4">
			<div className={"h-10"} />
			<FadeHeader title={"Settings"} />

			<VerticalNav items={walletItems} />
			<VerticalNav items={navigationItems} />
			{navigationPluginsItems.length > 0 && (
				<VerticalNav title={"Plugins"} items={navigationPluginsItems} />
			)}
			<VerticalNav items={navigationItems3} />
			<InstallPWA />

			<VerticalNav title={"External links"} items={navigationLinkItems} />

			<div className={"text-center text-sm"}>
				App version: <strong>{commitHash}</strong>
			</div>

			<div className={"text-center text-sm"}>We are OpenSource</div>
		</div>
	);
}
