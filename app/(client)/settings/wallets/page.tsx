"use client";

import { sqliteTrue } from "@evolu/common";
import {
	ChevronDownIcon,
	EditIcon,
	PlusIcon,
	TrashIcon,
	WalletIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { VerticalNav } from "@/app/(client)/settings/vertial-nav";
import { FadeHeader } from "@/components/fade-header";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useEvolu } from "@/hooks/use-evolu";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { useGlobalDialog } from "@/hooks/use-global-dialog";
import { createQuery } from "@/lib/evolu";
import { cn } from "@/lib/shared/ui/cn";

export default function Page() {
	const { t } = useTranslation();
	const router = useRouter();
	const evolu = useEvolu();
	const { confirm } = useGlobalDialog();
	const query = useMemo(
		() =>
			createQuery((db) =>
				db
					.selectFrom("account")
					.select([
						"account.id as id",
						"account.name as name",
						"account._tag as _tag",
					] as const)
					.where("account.isDeleted", "is not", sqliteTrue)
					.orderBy("account.createdAt", "desc"),
			),
		[],
	);
	const { data: items } = useEvoluQuery(query);

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
						<span>{t("common:actions.edit")}</span>
					</DropdownMenuItem>
					<DropdownMenuItem>
						<TrashIcon />
						<span>{t("common:actions.delete")}</span>
					</DropdownMenuItem>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);

	return (
		<div className="space-y-14 w-full px-4">
			<div className={"h-10"} />
			<FadeHeader title={t("settings:page.navigation.connectedWallets")} />

			<div className={"flex my-10 w-full justify-center"}>
				<Link href={"/settings/wallets/new"}>
					<Button variant="primary" size={"lg"}>
						<PlusIcon />
						{t("settings:wallets.page.connectWallet")}
					</Button>
				</Link>
			</div>

			{items && items.length === 0 && (
				<div
					className={"h-full flex flex-col justify-center items-center gap-8"}
				>
					<WalletIcon className="h-12 w-12 text-muted-foreground" />
					<h2 className={"text-foreground text-lg"}>
						{t("settings:wallets.page.noWalletPaired")}
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
								<strong>{item.name}</strong> ({item._tag})
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
													`/settings/wallets/edit?id=${encodeURIComponent(item.id)}`,
												);
											}}
										>
											<EditIcon />
											<span>{t("common:actions.edit")}</span>
										</DropdownMenuItem>
										<DropdownMenuItem
											onClick={async () => {
												const accepted = await confirm({
													title: t("settings:wallets.dialog.deleteTitle"),
													description: t(
														"settings:wallets.dialog.deleteDescription",
													),
													confirmText: t(
														"settings:wallets.dialog.deleteConfirmText",
													),
													cancelText: t(
														"settings:wallets.dialog.deleteCancelText",
													),
													confirmVariant: "destructive",
												});
												if (!accepted) {
													return;
												}

												evolu.update("account", {
													id: item.id,
													isDeleted: sqliteTrue,
												});
											}}
										>
											<TrashIcon />
											<span>{t("common:actions.delete")}</span>
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
