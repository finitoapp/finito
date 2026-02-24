import { Eye, EyeOff } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/shared/ui/cn";

export interface PasswordTextareaProps
	extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const PasswordTextarea = React.forwardRef<
	HTMLTextAreaElement,
	PasswordTextareaProps
>(({ className, ...props }, ref) => {
	const [showPassword, setShowPassword] = React.useState(false);

	return (
		<div className="relative w-full">
			<Textarea
				className={cn(
					"pr-10 font-mono",
					showPassword ? "" : "password-mask",
					className,
				)}
				ref={ref}
				{...props}
				style={
					showPassword
						? undefined
						: {
								// @ts-expect-error
								WebkitTextSecurity: "disc",
								textSecurity: "disc",
							}
				}
			/>
			<Button
				type="button"
				variant="ghost"
				size="sm"
				className="absolute right-0 top-0 h-10 px-3 py-2 hover:bg-transparent"
				onClick={() => setShowPassword((prev) => !prev)}
				aria-label={showPassword ? "Hide content" : "Show content"}
			>
				{showPassword ? (
					<EyeOff className="h-4 w-4 text-muted-foreground" />
				) : (
					<Eye className="h-4 w-4 text-muted-foreground" />
				)}
			</Button>
		</div>
	);
});
