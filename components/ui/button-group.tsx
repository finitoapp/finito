import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonGroupVariants = cva("inline-flex items-center justify-center", {
    variants: {
        variant: {
            default:
                "[&>*]:border-r-0 [&>*:last-child]:border-r [&>*:first-child]:rounded-r-none [&>*:last-child]:rounded-l-none [&>*:not(:first-child):not(:last-child)]:rounded-none",
            separated: "gap-1",
            pills: "gap-2 [&>*]:rounded-full",
        },
        size: {
            default: "",
            sm: "[&>*]:h-8 [&>*]:px-3 [&>*]:text-xs",
            lg: "[&>*]:h-12 [&>*]:px-8",
        },
    },
    defaultVariants: {
        variant: "default",
        size: "default",
    },
})

export interface ButtonGroupProps
    extends React.HTMLAttributes<HTMLDivElement>,
        VariantProps<typeof buttonGroupVariants> {
    children: React.ReactNode
}

const ButtonGroup = React.forwardRef<HTMLDivElement, ButtonGroupProps>(
    ({ className, variant, size, children, ...props }, ref) => {
        return (
            <div className={cn(buttonGroupVariants({ variant, size, className }))} ref={ref} role="group" {...props}>
                {children}
            </div>
        )
    },
)
ButtonGroup.displayName = "ButtonGroup"

export { ButtonGroup, buttonGroupVariants }
