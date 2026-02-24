import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/shared/ui/cn";

interface Step {
	id: string;
	label: React.ReactNode;
	description?: React.ReactNode;
}

interface ProgressStepsProps {
	steps: Step[];
	currentStep: number;
	className?: string;
}

export function ProgressSteps({
	steps,
	currentStep,
	className,
}: ProgressStepsProps) {
	return (
		<div className={cn("w-full", className)}>
			<div className="flex flex-col space-y-4">
				{steps.map((step, index) => {
					const stepNumber = index + 1;
					const isCompleted = stepNumber < currentStep;
					const isCurrent = stepNumber === currentStep;
					const isUpcoming = stepNumber > currentStep;

					return (
						<div key={step.id} className="flex items-start">
							<div className="flex flex-col items-center mr-3">
								<div
									className={cn(
										"flex h-6 w-6 items-center justify-center rounded-full border-2 text-xs font-medium transition-colors",
										{
											"border-primary bg-primary text-primary-foreground":
												isCompleted,
											"border-primary bg-background text-primary": isCurrent,
											"border-muted-foreground bg-background text-muted-foreground":
												isUpcoming,
										},
									)}
								>
									{isCompleted ? (
										<Check className="h-3 w-3" />
									) : isCurrent ? (
										<Loader2 className="h-3 w-3 animate-spin" />
									) : (
										<span>{stepNumber}</span>
									)}
								</div>

								{index < steps.length - 1 && (
									<div
										className={cn("w-0.5 h-8 mt-2 transition-colors", {
											"bg-primary": stepNumber < currentStep,
											"bg-muted": stepNumber >= currentStep,
										})}
									/>
								)}
							</div>

							<div className="flex-1 min-w-0">
								<div
									className={cn("text-sm font-medium", {
										"text-primary": isCompleted || isCurrent,
										"text-muted-foreground": isUpcoming,
									})}
								>
									{step.label}
								</div>
								{step.description && (
									<div className="mt-1 text-xs text-muted-foreground">
										{step.description}
									</div>
								)}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
