"use client";

import { getOrThrow, PositiveInt, sqliteTrue } from "@evolu/common";
import { IconPlus } from "@tabler/icons-react";
import { useAtomValue, useSetAtom } from "jotai";
import {
	ChevronsUpDownIcon,
	HardDriveDownloadIcon,
	LogOutIcon,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { deviceEvoluAtom } from "@/atoms/device-evolu";
import { evoluCounterAtom } from "@/atoms/evolu-counter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@/components/ui/sidebar";
import { useCreateQuery } from "@/hooks/use-create-query";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { useGlobalDialog } from "@/hooks/use-global-dialog";
import { useInstallPwa } from "@/hooks/use-install-pwa";

type Account = {
	id: string;
	name: string;
};

export function NavUser({
	user,
}: {
	user: {
		name: string;
		email: string;
		avatar: string;
	};
}) {
	const { t } = useTranslation();
	const { setOpenMobile } = useSidebar();
	const { onClick, isPwaSupported } = useInstallPwa();
	const { withConfirm } = useGlobalDialog();
	const deviceEvolu = useAtomValue(deviceEvoluAtom);
	const setEvoluCounter = useSetAtom(evoluCounterAtom);

	const accountsQuery = useCreateQuery(
		(db: any) =>
			db
				.selectFrom("account")
				.select(["account.id as id", "account.name as name"])
				.where("isDeleted", "is not", sqliteTrue)
				.orderBy("lastUseAt", "desc"),
		[],
		deviceEvolu as never,
	);
	const { data: accountRows } = useEvoluQuery(
		accountsQuery,
		deviceEvolu as never,
	);
	const accounts = useMemo<Account[]>(
		() =>
			(accountRows ?? []).flatMap((row) =>
				row.name === null || row.name === undefined
					? []
					: [{ id: row.id as string, name: row.name as string }],
			),
		[accountRows],
	);

	const activeAccountId = accounts[0]?.id;
	const activeAccountName =
		accounts[0]?.name ?? t("navigation:account.unknown");

	const logout = useCallback(async () => {
		const currentAccount = accounts[0];
		if (!currentAccount) {
			return;
		}

		await new Promise<void>((resolve) => {
			getOrThrow(
				deviceEvolu.update(
					"account",
					{
						id: currentAccount.id as never,
						isDeleted: sqliteTrue,
					},
					{
						onComplete: resolve,
					},
				),
			);
		});

		setEvoluCounter((value) => value + 1);
	}, [accounts, deviceEvolu, setEvoluCounter]);

	const logoutWithConfirm = useMemo(
		() =>
			withConfirm(logout, {
				title: t("navigation:account.confirmLogout.title"),
				description: t("navigation:account.confirmLogout.description"),
				confirmText: t("navigation:account.actions.logout"),
				cancelText: t("navigation:account.actions.cancel"),
				confirmVariant: "destructive",
			}),
		[logout, t, withConfirm],
	);

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<SidebarMenuButton
							size="lg"
							className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
						>
							<Avatar className="h-8 w-8 rounded-lg grayscale">
								<AvatarImage src={user.avatar} alt={user.name} />
								<AvatarFallback className="rounded-lg">
									{t("navigation:account.initials")}
								</AvatarFallback>
							</Avatar>
							<div className="grid flex-1 text-left text-sm leading-tight">
								<span className="truncate font-medium">
									{activeAccountName}
								</span>
							</div>
							<ChevronsUpDownIcon className="ml-auto" />
						</SidebarMenuButton>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
						side={"top"}
						align="end"
						sideOffset={4}
					>
						<DropdownMenuLabel>
							{t("navigation:account.accounts")}
						</DropdownMenuLabel>
						{accounts.map((account) => {
							return (
								<DropdownMenuItem
									disabled={account.id === activeAccountId}
									key={account.id}
									className="p-0 font-normal"
									onClick={async () => {
										await new Promise<void>((resolve) => {
											getOrThrow(
												deviceEvolu.update(
													"account",
													{
														id: account.id as never,
														lastUseAt: PositiveInt.orThrow(Date.now()),
													},
													{
														onComplete: resolve,
													},
												),
											);
										});

										setEvoluCounter((value) => value + 1); // Reload
									}}
								>
									<div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
										<Avatar className="h-8 w-8 rounded-lg">
											<AvatarImage src={user.avatar} alt={account.name} />
											<AvatarFallback className="rounded-lg">
												{t("navigation:account.initials")}
											</AvatarFallback>
										</Avatar>
										<div className="grid flex-1 text-left text-sm leading-tight">
											<span className="truncate font-medium">
												{account.name}
											</span>
										</div>
									</div>
								</DropdownMenuItem>
							);
						})}
						<DropdownMenuItem asChild>
							<Link
								href={"/admin/settings/switch-account"}
								onClick={() => setOpenMobile(false)}
							>
								<IconPlus />
								{t("navigation:account.actions.addAccount")}
							</Link>
						</DropdownMenuItem>
						<DropdownMenuSeparator
							title={t("navigation:account.actions.label")}
						/>
						<DropdownMenuLabel>
							{t("navigation:account.currentAccount")}
						</DropdownMenuLabel>
						<DropdownMenuItem
							onClick={() => void logoutWithConfirm()}
							disabled={accounts.length <= 1}
						>
							<LogOutIcon />
							{t("navigation:account.actions.logout")}
						</DropdownMenuItem>
						{isPwaSupported && (
							<DropdownMenuItem>
								<HardDriveDownloadIcon onClick={onClick} />
								{t("navigation:account.actions.install")}
							</DropdownMenuItem>
						)}
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
