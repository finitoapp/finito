import { X } from "lucide-react";
import { useCallback, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/shared/ui/cn";

type TagInputProps = {
	id: string;
	value: ReadonlyArray<string>;
	onValueChange: (value: string[]) => void;
	onSubmit?: () => void;
	onEscape?: () => void;
	placeholder?: string;
	className?: string;
	autoFocus?: boolean;
};

const splitTags = (value: string): string[] =>
	value
		.split(/[,\n]/)
		.map((tag) => tag.trim())
		.filter((tag) => tag.length > 0);

const mergeUniqueTags = (
	currentTags: ReadonlyArray<string>,
	nextTags: ReadonlyArray<string>,
): string[] => [...new Set([...currentTags, ...nextTags])];

export function TagInput({
	id,
	value,
	onValueChange,
	onSubmit,
	onEscape,
	placeholder,
	className,
	autoFocus = false,
}: TagInputProps) {
	const [draft, setDraft] = useState("");

	const appendDraftAsTags = useCallback(() => {
		const parsedTags = splitTags(draft);
		if (parsedTags.length === 0) {
			return false;
		}

		onValueChange(mergeUniqueTags(value, parsedTags));
		setDraft("");
		return true;
	}, [draft, onValueChange, value]);

	return (
		<div
			className={cn(
				"flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent px-2 py-1 transition-[color,box-shadow] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
				className,
			)}
		>
			{value.map((tag) => (
				<Badge key={tag} variant="secondary" className="h-6 gap-1 pr-1">
					<span className="max-w-40 truncate">{tag}</span>
					<button
						type="button"
						className="inline-flex cursor-pointer rounded-full p-0.5 hover:bg-muted"
						onClick={() => {
							onValueChange(value.filter((item) => item !== tag));
						}}
						aria-label={`Remove tag ${tag}`}
					>
						<X className="size-3" />
					</button>
				</Badge>
			))}

			<Input
				id={id}
				value={draft}
				className="h-7 min-w-32 flex-1 border-0 px-0 py-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
				placeholder={placeholder}
				autoFocus={autoFocus}
				onChange={(event) => {
					setDraft(event.target.value);
				}}
				onBlur={() => {
					appendDraftAsTags();
				}}
				onPaste={(event) => {
					const pastedText = event.clipboardData.getData("text");
					if (!/[,\n]/.test(pastedText)) {
						return;
					}

					event.preventDefault();
					const parsedTags = splitTags(pastedText);
					if (parsedTags.length === 0) {
						return;
					}

					onValueChange(mergeUniqueTags(value, parsedTags));
				}}
				onKeyDown={(event) => {
					if (event.key === "Escape") {
						event.preventDefault();
						onEscape?.();
						return;
					}

					if (event.key === "Enter" || event.key === ",") {
						event.preventDefault();
						const hasAddedTags = appendDraftAsTags();
						if (!hasAddedTags && event.key === "Enter") {
							onSubmit?.();
						}
						return;
					}

					if (
						event.key === "Backspace" &&
						draft.length === 0 &&
						value.length > 0
					) {
						event.preventDefault();
						onValueChange(value.slice(0, -1));
					}
				}}
			/>
		</div>
	);
}
