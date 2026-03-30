import { z } from "zod";
import { Currency, NonEmptyString255Schema } from "@/lib/shared/types";

export const createItemToolName = "create_item" as const;

export const createItemToolInputSchema = z.object({
	label: NonEmptyString255Schema.describe(
		"Display name of the sales item. Example: Espresso",
	),
	price: z
		.string()
		.trim()
		.min(1)
		.describe(
			"Decimal price string in major units. Use dot as decimal separator. Example: 49.90",
		),
	currency: z
		.enum(Currency)
		.nullable()
		.optional()
		.describe(
			"Item currency. Use null when user did not specify it and no default currency exists.",
		),
	unitOfMeasure: z
		.string()
		.trim()
		.max(64)
		.nullable()
		.optional()
		.describe("Optional unit of measure, e.g. ks, g, ml."),
});

export type CreateItemToolInput = z.infer<typeof createItemToolInputSchema>;

export const createItemToolOutputSchema = z.object({
	success: z.boolean(),
	message: z.string(),
	itemId: z.string().optional(),
});

export type CreateItemToolOutput = z.infer<typeof createItemToolOutputSchema>;

export const createItemAssistantSystemPrompt = (params: {
	defaultCurrency: string | null;
}) => `
You are an assistant for a POS and inventory app.

Your job:
- Help the user create sales items.
- Use tool "${createItemToolName}" only when all required fields are known:
  - label
  - price (decimal string)
  - currency
- If currency is missing, use default currency "${params.defaultCurrency ?? "unknown"}" only when it is not "unknown".
- If any required field is still missing, ask one short follow-up question in the user's language.
- Keep responses concise.
- Never invent fields the user did not provide.
`;
