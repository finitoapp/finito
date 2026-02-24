import { Eye, EyeOff } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/shared/ui/cn";

export interface PasswordInputProps
	extends React.InputHTMLAttributes<HTMLInputElement> {}

export const PasswordInput = React.forwardRef<
	HTMLInputElement,
	PasswordInputProps
>(({ className, ...props }, ref) => {
	const [showPassword, setShowPassword] = React.useState(false);

	return (
		<div className="relative w-full">
			<Input
				type={showPassword ? "text" : "password"}
				className={cn("pr-10", className)}
				ref={ref}
				{...props}
			/>
			<Button
				type="button"
				variant="ghost"
				size="sm"
				className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
				onClick={() => setShowPassword((prev) => !prev)}
				aria-label={showPassword ? "Hide password" : "Show password"}
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
