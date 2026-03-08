import { id } from "@evolu/common";
import { z } from "zod";

export const Id = id("Id");
export type Id = typeof Id.Type;

export const TableIdSchema: z.ZodType<Id, Id> = z
	.custom<Id>()
	.transform((value) => value as unknown as Id);
