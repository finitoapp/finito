"use client";

import {
	ChevronDownIcon,
	EditIcon,
	PlusIcon,
	TrashIcon,
	WalletIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { VerticalNav } from "@/app/(client)/settings/vertial-nav";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useNostr } from "@/hooks/use-nostr";
import { useStorageSubscription } from "@/hooks/use-storage-subscription";
import { cn } from "@/lib/utils";
import { accountStorage } from "@/storages/account-storage";

export default function Page() {
	const router = useRouter();
	const { ndk } = useNostr();
	const {
		data: items,
		hasNextPage,
		loadNextPage,
		eose,
	} = useStorageSubscription(accountStorage, {
		limit: 20,
	});

	const emptyAction = (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" size={"icon"}>
					<ChevronDownIcon />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="w-64">
				<DropdownMenuGroup>
					<DropdownMenuItem>
						<EditIcon />
						<span>Edit</span>
					</DropdownMenuItem>
					<DropdownMenuItem>
						<TrashIcon />
						<span>Delete</span>
					</DropdownMenuItem>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);

	return (
		<div className="space-y-14 w-full px-4">
			<div className={"h-10"} />
			<Header title={"Connected wallets"} backPath={"/settings"} />

			<div className={"flex my-10 w-full justify-center"}>
				<Link href={"/settings/wallets/new"}>
					<Button variant="primary" size={"lg"}>
						<PlusIcon />
						Connect a wallet
					</Button>
				</Link>
			</div>

			{eose && items && items.length === 0 && (
				<div
					className={"h-full flex flex-col justify-center items-center gap-8"}
				>
					<WalletIcon className="h-12 w-12 text-muted-foreground" />
					<h2 className={"text-foreground text-lg"}>
						You currently have no wallet paired.
					</h2>
					<div className={"h-20"}></div>
				</div>
			)}

			<VerticalNav
				items={(items ?? [null, null, null, null]).map((item, index) => {
					if (item === null) {
						return {
							className:
								index === 1
									? "opacity-70"
									: index === 2
										? "opacity-50"
										: index === 3
											? "opacity-25"
											: index === 4
												? "opacity-15"
												: undefined,
							label: (
								<div className={cn("flex flex-col gap-2 items-start w-max")}>
									<strong>
										<Skeleton className={"h-5 w-[250px]"} />
									</strong>
								</div>
							),
							action: emptyAction,
						};
					}

					return {
						label: (
							<div className={"items-start w-max"}>
								<strong>{item.value.name}</strong> ({item.value._tag})
							</div>
						),
						action: (
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button variant="outline" size={"icon"}>
										<ChevronDownIcon />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent className="w-64">
									<DropdownMenuGroup>
										<DropdownMenuItem
											onClick={() => {
												router.push(
													`/settings/wallets/edit?id=${encodeURIComponent(item.key ?? "")}`,
												);
											}}
										>
											<EditIcon />
											<span>Edit</span>
										</DropdownMenuItem>
										<DropdownMenuItem
											onClick={async () => {
												await accountStorage.delete(ndk, item.eventId);
											}}
										>
											<TrashIcon />
											<span>Delete</span>
										</DropdownMenuItem>
									</DropdownMenuGroup>
								</DropdownMenuContent>
							</DropdownMenu>
						),
					};
				})}
			/>
		</div>
	);
}
