"use client";

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import {
	createIdFromString,
	type KyselyNotNull,
	sqliteTrue,
} from "@evolu/common";
import { generateText, type ModelMessage, stepCountIs, tool } from "ai";
import { useAtomValue } from "jotai";
import { LoaderCircleIcon, SendIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { accountAtom } from "@/atoms/account";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useEvolu } from "@/hooks/use-evolu";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import {
	createItemAssistantSystemPrompt,
	createItemToolInputSchema,
	createItemToolName,
} from "@/lib/ai/item-assistant";
import { createQuery } from "@/lib/evolu";
import { createCatalogItem } from "@/lib/item/service";
import { NonEmptyString, NonEmptyString255 } from "@/lib/shared/types";
import { decimalStringToMinorUnits } from "@/lib/shared/zod/money-codec";

type ChatMessage = {
	id: string;
	role: "user" | "assistant";
	content: string;
};

const createMessageId = () =>
	globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);

const toModelMessages = (messages: readonly ChatMessage[]): ModelMessage[] =>
	messages.map((message) => ({
		role: message.role,
		content: message.content,
	}));

export function AiAssistantChat() {
	const evolu = useEvolu();
	const account = useAtomValue(accountAtom);
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [prompt, setPrompt] = useState("");
	const [isGenerating, setIsGenerating] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const settingsId = createIdFromString("");

	const aiSettingsQuery = useMemo(
		() =>
			createQuery((db) =>
				db
					.selectFrom("aiAssistantSettings")
					.select(["googleApiKey"] as const)
					.where("isDeleted", "is not", sqliteTrue)
					.where("id", "=", settingsId)
					.where("googleApiKey", "is not", null)
					.$narrowType<{
						googleApiKey: KyselyNotNull;
					}>(),
			),
		[settingsId],
	);
	const { data: aiSettingsRows } = useEvoluQuery(aiSettingsQuery);

	const billingSettingsQuery = useMemo(
		() =>
			createQuery((db) =>
				db
					.selectFrom("billingSettings")
					.select(["defaultCurrency"] as const)
					.where("isDeleted", "is not", sqliteTrue)
					.where("id", "=", settingsId)
					.where("defaultCurrency", "is not", null)
					.$narrowType<{
						defaultCurrency: KyselyNotNull;
					}>(),
			),
		[settingsId],
	);
	const { data: billingSettingsRows } = useEvoluQuery(billingSettingsQuery);

	const googleApiKey = aiSettingsRows[0]?.googleApiKey ?? null;
	const defaultCurrency = billingSettingsRows[0]?.defaultCurrency ?? null;

	const submitPrompt = async () => {
		const nextPrompt = prompt.trim();
		if (nextPrompt === "" || isGenerating) {
			return;
		}

		if (googleApiKey === null) {
			toast.error("Nejprve nastavte Google API key v nastavení asistenta.");
			return;
		}

		const userMessage: ChatMessage = {
			id: createMessageId(),
			role: "user",
			content: nextPrompt,
		};

		const nextMessages = [...messages, userMessage];
		setMessages(nextMessages);
		setPrompt("");
		setIsGenerating(true);
		setError(null);

		try {
			const google = createGoogleGenerativeAI({
				apiKey: googleApiKey,
			});

			const result = await generateText({
				model: google("gemini-2.5-flash-lite"),
				system: createItemAssistantSystemPrompt({
					defaultCurrency,
				}),
				messages: toModelMessages(nextMessages),
				tools: {
					create_item: tool({
						description: "Create a new sales item in the local inventory.",
						inputSchema: createItemToolInputSchema,
						execute: async (input) => {
							const currency = input.currency ?? defaultCurrency ?? null;

							if (currency === null) {
								return {
									success: false,
									message:
										"Nemohu vytvořit položku bez měny. Doplň prosím měnu.",
								};
							}

							const normalizedPrice = input.price.replace(",", ".").trim();
							const price = decimalStringToMinorUnits({
								value: normalizedPrice,
								currency,
							});

							if (price === null) {
								return {
									success: false,
									message:
										"Cena má neplatný formát. Použij prosím číslo, například 49.90.",
								};
							}

							const catalogItem = createCatalogItem({
								evolu,
							})({
								catalogItem: {
									deviceId: account.device.id,
									label: NonEmptyString255(input.label.trim()),
									price,
									costPrice: null,
									currency,
									unitOfMeasure:
										input.unitOfMeasure && input.unitOfMeasure.trim() !== ""
											? NonEmptyString(input.unitOfMeasure.trim())
											: null,
									internalCode: null,
									productCodeType: null,
									productCodeValue: null,
									categoryId: null,
								},
							});

							toast.success(`Položka "${catalogItem.label}" byla vytvořena.`);

							return {
								success: true,
								message: `Položka "${catalogItem.label}" byla vytvořena.`,
								itemId: catalogItem.id,
							};
						},
					}),
				},
				stopWhen: stepCountIs(5),
			});

			const assistantText = result.text.trim();
			const firstToolResult = result.toolResults.find(
				(part) =>
					part.type === "tool-result" && part.toolName === createItemToolName,
			);
			const toolMessage =
				firstToolResult && "output" in firstToolResult
					? (firstToolResult.output as { message?: unknown })
					: null;
			const fallbackMessage =
				toolMessage && typeof toolMessage.message === "string"
					? toolMessage.message
					: "Hotovo.";

			setMessages((prev) => [
				...prev,
				{
					id: createMessageId(),
					role: "assistant",
					content: assistantText === "" ? fallbackMessage : assistantText,
				},
			]);
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "Nepodařilo se odpovědět. Zkuste to prosím znovu.";
			setError(message);
			toast.error("Asistent selhal. Zkuste to prosím znovu.");
		} finally {
			setIsGenerating(false);
		}
	};

	if (googleApiKey === null) {
		return (
			<div className="rounded-md border border-border p-4 text-sm">
				<div className="mb-3">
					Pro použití asistenta nejprve uložte Google API klíč v nastavení.
				</div>
				<Button
					nativeButton={false}
					render={<Link href="/admin/ai-assistant/settings" />}
					variant="outline"
				>
					Otevřít nastavení asistenta
				</Button>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<ScrollArea className="h-80 rounded-md border border-border p-3">
				<div className="flex flex-col gap-2 pr-3">
					{messages.length === 0 && (
						<div className="text-sm text-muted-foreground">
							Napište například: „vytvoř novou prodejní položku Espresso za 59
							CZK“.
						</div>
					)}

					{messages.map((message) => (
						<div
							key={message.id}
							className={
								"max-w-[85%] rounded-md px-3 py-2 text-sm whitespace-pre-wrap " +
								(message.role === "user"
									? "ml-auto bg-primary text-primary-foreground"
									: "bg-muted text-foreground")
							}
						>
							{message.content}
						</div>
					))}
				</div>
			</ScrollArea>

			<div className="space-y-2">
				<Textarea
					value={prompt}
					placeholder="Napište požadavek…"
					onChange={(event) => setPrompt(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === "Enter" && !event.shiftKey) {
							event.preventDefault();
							void submitPrompt();
						}
					}}
				/>
				<div className="flex items-center justify-between gap-2">
					<div className="text-xs text-muted-foreground">{error}</div>
					<Button
						type="button"
						onClick={() => void submitPrompt()}
						disabled={isGenerating || prompt.trim() === ""}
					>
						{isGenerating ? (
							<LoaderCircleIcon className="animate-spin" />
						) : (
							<SendIcon />
						)}
						Odeslat
					</Button>
				</div>
			</div>
		</div>
	);
}
