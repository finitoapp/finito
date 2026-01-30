"use client";

import { getOrThrow, sqliteTrue } from "@evolu/common";
import { useMutation } from "@tanstack/react-query";
import { EditIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BackButton } from "@/components/back-button";
import { KeyValueList } from "@/components/key-value-list";
import { ResponsiveCard } from "@/components/responsive-card";
import { StaticCard } from "@/components/static-card";
import { Button } from "@/components/ui/button";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCreateQuery } from "@/hooks/use-create-query";
import { useEvolu } from "@/hooks/use-evolu";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { useGlobalDialog } from "@/hooks/use-global-dialog";

export default function Home() {
	const evolu = useEvolu();
	const { withConfirm } = useGlobalDialog();
	const searchParams = useSearchParams();
	const id = searchParams.get("id");
	const router = useRouter();
	if (id === null) {
		throw Promise.reject();
	}

	const categoryQuery = useCreateQuery(
		(db) => {
			return db
				.selectFrom("category")
				.selectAll()
				.where("category.isDeleted", "is not", sqliteTrue)
				.where("category.id", "=", id as never);
		},
		[id],
	);
	const itemsQuery = useCreateQuery(
		(db) =>
			db
				.selectFrom("item")
				.select(["item.id as id"] as const)
				.where("item.isDeleted", "is not", sqliteTrue)
				.where("item.categoryId", "=", id as never),
		[id],
	);

	const { data: categories } = useEvoluQuery(categoryQuery);
	const { data: items } = useEvoluQuery(itemsQuery);

	const category = categories && categories[0];
	const productsCount = items?.length ?? 0;

	const { mutateAsync: deleteCategory } = useMutation({
		mutationFn: async () => {
			if (category === undefined) {
				return;
			}

			getOrThrow(
				evolu.update("category", {
					id: category.id,
					isDeleted: sqliteTrue,
				}),
			);

			router.push("/admin/categories" as never);
		},
	});

	const onDelete = withConfirm(
		async () => {
			await deleteCategory();
		},
		{
			title: "Delete category?",
			description: "This action cannot be undone.",
			confirmText: "Delete",
			cancelText: "Cancel",
			confirmVariant: "destructive",
		},
	);

	return (
		<div className={"w-full lg:max-w-7xl"}>
			<div className={"mb-6"}>
				<BackButton />
			</div>

			<div className={"flex gap-4 flex-wrap"}>
				<ResponsiveCard className={"flex-2"}>
					<CardHeader>
						<CardTitle>
							{!category && <Skeleton />}
							{category?.name}
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className={"flex flex-col gap-8"}>
							<div className={"flex gap-4"}>
								<StaticCard
									title={"Products"}
									content={
										<>
											{!category && <Skeleton />}
											{category && productsCount.toString()}
										</>
									}
									className={"flex-1"}
								/>
								<StaticCard
									title={"Modified at"}
									content={
										<>
											{!category && <Skeleton />}
											{category &&
												new Date(category.createdAt).toLocaleDateString()}
										</>
									}
									footer={
										category &&
										new Date(category.createdAt).toLocaleTimeString()
									}
									className={"flex-1"}
								/>
							</div>
							<KeyValueList
								items={[
									{
										key: "Name",
										value: category?.name ?? "-",
									},
								]}
							/>
						</div>
					</CardContent>
				</ResponsiveCard>

				<div className={"flex-1 flex flex-col gap-4"}>
					<ResponsiveCard>
						<CardHeader>
							<CardTitle>Actions</CardTitle>
						</CardHeader>
						<CardContent className={"space-y-2"}>
							<Button variant={"outline"} className={"w-full"} asChild>
								<Link
									href={
										`/admin/categories/edit?id=${encodeURIComponent(id)}` as never
									}
								>
									<EditIcon />
									Edit
								</Link>
							</Button>
							<Button className={"w-full"} onClick={() => void onDelete()}>
								<Trash2Icon />
								Delete
							</Button>
						</CardContent>
					</ResponsiveCard>
				</div>
			</div>
		</div>
	);
}
