"use client"
import { Check, ChevronDown } from "lucide-react"
import { cn } from "@/lib/shared/ui/cn"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {ComponentProps} from "react";

interface SelectButtonOption<TValue extends string = string> {
    value: TValue
    label: string
}

interface SelectButtonProps<TValue extends string = string> {
    options: SelectButtonOption<TValue>[]
    value?: string
    onValueChange?: (value: TValue) => void
    placeholder?: string
    className?: string
    variant?: ComponentProps<typeof Button>['variant']
    size?: ComponentProps<typeof Button>['size'];
}

export function SelectButton<TValue extends string = string>({
                                 options,
                                 value,
                                 onValueChange,
                                 placeholder = "Select an option",
                                 className,
                                 variant = "outline",
                                 size = null,
                             }: SelectButtonProps<TValue>) {
    const selectedOption = options.find((option) => option.value === value)

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant={variant}
                    size={size}
                    className={cn("justify-between font-normal", !selectedOption && "text-muted-foreground", className)}
                >
                    <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-full min-w-[var(--radix-dropdown-menu-trigger-width)]">
                {options.map((option) => (
                    <DropdownMenuItem
                        key={option.value}
                        onSelect={() => onValueChange?.(option.value)}
                        className="flex items-center justify-between"
                    >
                        <span>{option.label}</span>
                        {value === option.value && <Check className="h-4 w-4" />}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
