"use client";

import { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { IconPlus } from "@tabler/icons-react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
	ChevronsUpDownIcon,
	HardDriveDownloadIcon,
	LogOutIcon,
} from "lucide-react";
import Link from "next/link";
import { privateKeyFromSeedWords } from "nostr-tools/nip06";
import { useCallback, useEffect, useState } from "react";
import { seedAtom } from "@/atoms/seed";
import { seedsAtom } from "@/atoms/seeds";
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
import { useInstallPwa } from "@/hooks/use-install-pwa";
import { useNostr } from "@/hooks/use-nostr";
import { useNostrProfile } from "@/hooks/useNostrProfile";
import type { NonEmptyString } from "@/lib/types";

type Account = {
	pubkey: string;
	npub: string;
	payload: NonEmptyString;
	name?: string;
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
	const { setOpenMobile } = useSidebar();
	const { ndk } = useNostr();
	const profile = useNostrProfile() ?? {};
	const { onClick, isPwaSupported } = useInstallPwa();
	const seeds = useAtomValue(seedsAtom);
	const [accounts, setAccounts] = useState<Account[]>([]);
	const [seed, setSeed] = useAtom(seedAtom);
	const setSeeds = useSetAtom(seedsAtom);

	useEffect(() => {
		(async () => {
			const result = await Promise.all(
				(seeds ?? { seeds: [] }).seeds.map(async (seed) => {
					const privateKey = privateKeyFromSeedWords(seed);
					const signer = new NDKPrivateKeySigner(privateKey);

					const user = await signer.user();

					return {
						profile: await user.fetchProfile(),
						signer,
						payload: seed,
					};
				}),
			);

			const accounts: Account[] = [];

			for (const row of result) {
				if (!row) {
					continue;
				}

				accounts.push({
					pubkey: row.signer.pubkey,
					npub: row.signer.userSync.npub,
					name: row.profile?.name,
					payload: row.payload,
				});
			}

			setAccounts(accounts);
		})();
	}, [seeds]);

	const logout = useCallback(async () => {
		let theBestNdkSignerPayload: NonEmptyString | null = null;

		setSeeds((previous) => {
			const newSigners: NonEmptyString[] = [];

			for (const previousSeed of (previous ?? { seeds: [] }).seeds) {
				if (previousSeed !== seed) {
					if (theBestNdkSignerPayload === null) {
						theBestNdkSignerPayload = previousSeed;
					}

					newSigners.push(previousSeed);
				}
			}

			return {
				seeds: [...newSigners],
			};
		});

		if (theBestNdkSignerPayload === null) {
			return;
		}

		setSeed(theBestNdkSignerPayload);
	}, [seed, setSeed, setSeeds]);

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
								<AvatarFallback className="rounded-lg">CN</AvatarFallback>
							</Avatar>
							<div className="grid flex-1 text-left text-sm leading-tight">
								<span className="truncate font-medium">
									{profile.name ?? "unknown"}
								</span>
								<span className="text-muted-foreground truncate text-xs">
									{ndk.activeUser.npub}
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
						<DropdownMenuLabel>Accounts</DropdownMenuLabel>
						{accounts.map((account) => {
							return (
								<DropdownMenuItem
									disabled={account.pubkey === ndk.activeUser.pubkey}
									key={account.pubkey}
									className="p-0 font-normal"
									onClick={() => {
										setSeed(account.payload);
									}}
								>
									<div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
										<Avatar className="h-8 w-8 rounded-lg">
											<AvatarImage src={user.avatar} alt={account.pubkey} />
											<AvatarFallback className="rounded-lg">CN</AvatarFallback>
										</Avatar>
										<div className="grid flex-1 text-left text-sm leading-tight">
											<span className="truncate font-medium">
												{account.name ?? "unknown"}
											</span>
											<span className="text-muted-foreground truncate text-xs">
												{account.npub}
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
								Add account
							</Link>
						</DropdownMenuItem>
						<DropdownMenuSeparator title={"Actions"} />
						<DropdownMenuLabel>Current account</DropdownMenuLabel>
						<DropdownMenuItem onClick={logout} disabled={accounts.length <= 1}>
							<LogOutIcon />
							Logout
						</DropdownMenuItem>
						{isPwaSupported && (
							<DropdownMenuItem>
								<HardDriveDownloadIcon onClick={onClick} />
								Install
							</DropdownMenuItem>
						)}
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
