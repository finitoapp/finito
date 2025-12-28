import { z } from "zod";
import {
	NonEmptyStringSchema,
	StringToNullableStringSchema,
	WssUrlSchema,
} from "@/lib/types";

export const credentialsSchema = z.object({
	npub: StringToNullableStringSchema.pipe(NonEmptyStringSchema),
	nsec: StringToNullableStringSchema.pipe(NonEmptyStringSchema),
	relay1: StringToNullableStringSchema.pipe(WssUrlSchema),
	relay2: StringToNullableStringSchema.pipe(WssUrlSchema.nullable()),
	relay3: StringToNullableStringSchema.pipe(WssUrlSchema.nullable()),
	relay4: StringToNullableStringSchema.pipe(WssUrlSchema.nullable()),
});

export const credentialsDefaultValues = {
	npub: "",
	nsec: "",
	relay1: "",
	relay2: "",
	relay3: "",
	relay4: "",
} satisfies z.input<typeof credentialsSchema>;
