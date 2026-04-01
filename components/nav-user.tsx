"use client";

import { type KyselyNotNull, sqliteTrue } from "@evolu/common";
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
	DropdownMenuGroup,
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
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { useGlobalDialog } from "@/hooks/use-global-dialog";
import { useInstallPwa } from "@/hooks/use-install-pwa";
import { createDeviceQuery } from "@/lib/evolu/device";
import { TimestampMs } from "@/lib/shared/types";

const accountsQuery = createDeviceQuery((db) =>
	db
		.selectFrom("account")
		.select(["account.id as id", "account.name as name"])
		.where("isDeleted", "is not", sqliteTrue)
		.where("name", "is not", null)
		.orderBy("lastUseAt", "desc")
		.$narrowType<{
			name: KyselyNotNull;
		}>(),
);

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

	const { data: accounts } = useEvoluQuery(accountsQuery, deviceEvolu);
	const activeAccountId = accounts[0]?.id;
	const activeAccountName =
		accounts[0]?.name ?? t("navigation:account.unknown");

	const logout = useCallback(async () => {
		const currentAccount = accounts[0];
		if (!currentAccount) {
			return;
		}

		await new Promise<void>((resolve) => {
			deviceEvolu.update(
				"account",
				{
					id: currentAccount.id,
					isDeleted: sqliteTrue,
				},
				{
					onComplete: resolve,
				},
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
					<DropdownMenuTrigger
						render={
							<SidebarMenuButton
								size="lg"
								className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
							/>
						}
					>
						<Avatar className="h-8 w-8 rounded-lg grayscale">
							<AvatarImage src={user.avatar} alt={user.name} />
							<AvatarFallback className="rounded-lg">
								{t("navigation:account.initials")}
							</AvatarFallback>
						</Avatar>
						<div className="grid flex-1 text-left text-sm leading-tight">
							<span className="truncate font-medium">{activeAccountName}</span>
						</div>
						<ChevronsUpDownIcon className="ml-auto" />
					</DropdownMenuTrigger>
					<DropdownMenuContent
						className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
						side={"top"}
						align="end"
						sideOffset={4}
					>
						<DropdownMenuGroup>
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
												deviceEvolu.update(
													"account",
													{
														id: account.id,
														lastUseAt: TimestampMs(Date.now()),
													},
													{
														onComplete: resolve,
													},
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
							<DropdownMenuItem
								render={
									<Link
										href={"/admin/switch-account"}
										onClick={() => setOpenMobile(false)}
									/>
								}
							>
								<IconPlus />
								{t("navigation:account.actions.addAccount")}
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
						</DropdownMenuGroup>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
