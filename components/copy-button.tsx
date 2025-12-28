/**
 * A customizable copy button component that can copy text, HTML, or content from a referenced element to the clipboard.
 * Supports both plain text and rich HTML content copying with automatic markdown conversion. This enables a user to copy
 * HTML content and paste into a HTML-aware editor or a plain text editor (as markdown).
 *
 * @see https://github.com/shadcn-ui/ui/discussions/4052
 */

import { Copy } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

interface CopyButtonProps extends React.ComponentProps<typeof Button> {
	/**
	 * Plain text content to copy to clipboard. Takes precedence over auto-generated plain-text version if HTML is provided.
	 */
	text?: string;

	/**
	 * HTML content to copy to clipboard. Will be converted to markdown for plain text format.
	 * Used when text prop is not provided.
	 */
	html?: string;

	/**
	 * React ref to an HTML element whose innerHTML will be copied.
	 * Used as fallback when neither text nor html props are provided.
	 */
	htmlRef?: React.RefObject<HTMLElement | null>;
}

export function CopyButton({
	text,
	html,
	htmlRef,
	className,
	...props
}: CopyButtonProps) {
	const [copied, setCopied] = useState(false);

	const copyToClipboard = async () => {
		try {
			if (!text && !html && !htmlRef?.current) {
				console.error("No text, HTML, or HTML reference to copy");
				return;
			}

			// @ts-expect-error
			await navigator.clipboard.writeText(text);

			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch (err) {
			console.error("Failed to copy text:", err);
		}
	};

	return (
		<Button
			variant="outline"
			size="sm"
			className={className}
			onClick={copyToClipboard}
			{...props}
		>
			{copied ? (
				<>
					<Copy className="mr-2 h-4 w-4" />
					Copied!
				</>
			) : (
				<Copy className="h-4 w-4" />
			)}
		</Button>
	);
}
