import type { InferEnumType } from "@/lib/types";

export const MenuStatus = {
	Draft: "draft",
	Published: "published",
} as const;
export type MenuStatus = InferEnumType<typeof MenuStatus>;
