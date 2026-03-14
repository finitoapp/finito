/**
 * A customizable copy button component that can copy text, HTML, or content from a referenced element to the clipboard.
 * Supports both plain text and rich HTML content copying with automatic markdown conversion. This enables a user to copy
 * HTML content and paste into a HTML-aware editor or a plain text editor (as markdown).
 *
 * @see https://github.com/shadcn-ui/ui/discussions/4052
 */

import { Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useClipboard } from "@/components/use-clipboard";

interface CopyButtonProps extends React.ComponentProps<typeof Button> {
	/**
	 * Plain text content to copy to clipboard. Takes precedence over auto-generated plain-text version if HTML is provided.
	 */
	text: string;
}

export function CopyButton({ text, className, ...props }: CopyButtonProps) {
	const { copy, copied } = useClipboard();

	return (
		<Button
			variant="outline"
			className={className}
			onClick={() => copy(text)}
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
