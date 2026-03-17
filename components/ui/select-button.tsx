"use client"
import { Button } from "@/components/ui/button"
import {ComponentProps} from "react";
import {Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {SelectRootChangeEventDetails} from "@base-ui/react";

interface SelectButtonOption<TValue extends string | null = string | null> {
    value: TValue
    label: string
}

interface SelectButtonProps<TValue extends string | null = string | null> {
    options: SelectButtonOption<TValue>[]
    value?: TValue | null;
    onValueChange?: (value: TValue | null, eventDetails: SelectRootChangeEventDetails) => void
    placeholder?: string
    className?: string
    variant?: ComponentProps<typeof Button>['variant']
    size?: ComponentProps<typeof SelectTrigger>['size'];
}

export function SelectButton<TValue extends string | null = string | null>({
                                 options,
                                 value,
                                 onValueChange,
                                 placeholder = "Select an option",
                                 className,
                                 variant = "outline",
                                 size = undefined,
                             }: SelectButtonProps<TValue>) {

    return (
        <Select<TValue> onValueChange={onValueChange} value={value} items={options}>
            <SelectTrigger size={size} className={className}>
              <SelectValue  />
            </SelectTrigger>
            <SelectContent className="w-full">
              <SelectGroup>
                {placeholder && value === null && (
                  <SelectItem
                    value={null}
                  >
                    {placeholder}
                  </SelectItem>
                )}
                {options.map((option) => (
                    <SelectItem
                        key={option.value}
                        value={option.value}
                    >
                       {option.label}
                    </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
        </Select>
    )
}
