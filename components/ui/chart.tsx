"use client"

import * as React from "react"
import type { TooltipProps } from "recharts"
import { Legend, ResponsiveContainer, Tooltip } from "recharts"

import { cn } from "@/lib/shared/ui/cn"

const THEMES = { light: "", dark: ".dark" } as const

export type ChartConfig = {
  [key: string]: {
    label?: React.ReactNode
    icon?: React.ComponentType
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<keyof typeof THEMES, string> }
  )
}

type ChartContextProps = {
  config: ChartConfig
}

const ChartContext = React.createContext<ChartContextProps | null>(null)

function useChart() {
  const context = React.useContext(ChartContext)

  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />")
  }

  return context
}

const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    config: ChartConfig
    children: React.ComponentProps<typeof ResponsiveContainer>["children"]
  }
>(({ id, className, children, config, ...props }, ref) => {
  const uniqueId = React.useId().replace(/:/g, "")
  const chartId = `chart-${id ?? uniqueId}`

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        ref={ref}
        data-chart={chartId}
        className={cn(
          "[&_path:focus]:outline-none [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-legend-item-text]:text-foreground [&_.recharts-tooltip-cursor]:stroke-border [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50",
          className
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <ResponsiveContainer>{children}</ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
})

ChartContainer.displayName = "Chart"

const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  const colorConfig = Object.entries(config).filter(
    ([, configValue]) => configValue.color || configValue.theme
  )

  if (colorConfig.length === 0) {
    return null
  }

  return (
    <style
      // biome-ignore lint/security/noDangerouslySetInnerHtml: controlled CSS variables from static config
      dangerouslySetInnerHTML={{
        __html: Object.entries(THEMES)
          .map(
            ([theme, prefix]) => `${prefix} [data-chart=${id}] {
${colorConfig
  .map(([key, chartConfig]) => {
    const color =
      chartConfig.theme?.[theme as keyof typeof chartConfig.theme] ??
      chartConfig.color

    if (!color) {
      return null
    }

    return `  --color-${key}: ${color};`
  })
  .filter(Boolean)
  .join("\n")}
}`
          )
          .join("\n"),
      }}
    />
  )
}

const ChartTooltip = Tooltip

type TooltipItem = {
  color?: string
  dataKey?: string | number
  name?: string | number
  value?: number | string | ReadonlyArray<number | string>
  payload?: Record<string, unknown> & { fill?: string }
}

type ChartTooltipContentProps = React.ComponentProps<"div"> & {
  active?: boolean
  payload?: TooltipItem[]
  label?: string | number
  labelFormatter?: (label: React.ReactNode, payload: TooltipItem[]) => React.ReactNode
  labelClassName?: string
  formatter?: (
    value: TooltipItem["value"],
    name: TooltipItem["name"],
    item: TooltipItem,
    index: number,
    payload: TooltipItem["payload"]
  ) => React.ReactNode
  hideLabel?: boolean
  hideIndicator?: boolean
  indicator?: "dot" | "line" | "dashed"
  nameKey?: string
  labelKey?: string
}

const ChartTooltipContent = React.forwardRef<
  HTMLDivElement,
  ChartTooltipContentProps
>(
  (
    {
      active,
      payload,
      className,
      indicator = "dot",
      hideLabel = false,
      hideIndicator = false,
      label,
      labelFormatter,
      labelClassName,
      formatter,
      color,
      nameKey,
      labelKey,
    },
    ref
  ) => {
    const { config } = useChart()

    const tooltipPayload =
      payload?.filter((item) => item.value !== undefined && item.value !== null) ?? []

    if (!active || tooltipPayload.length === 0) {
      return null
    }

    const tooltipLabel = React.useMemo(() => {
      if (hideLabel) {
        return null
      }

      const firstPayload = tooltipPayload[0]
      if (!firstPayload) {
        return null
      }

      const itemKey = `${labelKey || firstPayload.dataKey || firstPayload.name || "value"}`
      const itemConfig = getPayloadConfigFromPayload(config, firstPayload, itemKey)
      const displayedLabel =
        !labelKey && typeof label === "string"
          ? config[label]?.label || label
          : itemConfig?.label

      if (labelFormatter) {
        return (
          <div className={cn("font-medium", labelClassName)}>
            {labelFormatter(displayedLabel, tooltipPayload)}
          </div>
        )
      }

      if (!displayedLabel) {
        return null
      }

      return <div className={cn("font-medium", labelClassName)}>{displayedLabel}</div>
    }, [
      hideLabel,
      label,
      labelClassName,
      labelFormatter,
      tooltipPayload,
      config,
      labelKey,
    ])

    return (
      <div
        ref={ref}
        className={cn(
          "grid min-w-[9rem] gap-1.5 rounded-lg border bg-popover px-2.5 py-1.5 text-xs shadow-xl",
          className
        )}
      >
        {tooltipLabel}
        <div className="grid gap-1.5">
          {tooltipPayload.map((item, index) => {
            const itemKey = `${nameKey || item.name || item.dataKey || "value"}`
            const itemConfig = getPayloadConfigFromPayload(config, item, itemKey)
            const indicatorColor = color || item.payload?.fill || item.color

            const valueLabel = Array.isArray(item.value)
              ? item.value.join(" / ")
              : typeof item.value === "number"
                ? item.value.toLocaleString()
                : item.value

            return (
              <div
                key={`${item.dataKey || item.name || "item"}-${index}`}
                className={cn(
                  "flex w-full flex-wrap items-center gap-2 [&>svg]:size-2.5 [&>svg]:text-muted-foreground",
                  indicator === "dot" && "items-center"
                )}
              >
                {formatter ? (
                  formatter(item.value, item.name, item, index, item.payload)
                ) : (
                  <>
                    {!hideIndicator && (
                      <div
                        className={cn("shrink-0 rounded-[2px] border", {
                          "h-2.5 w-2.5": indicator === "dot",
                          "w-1": indicator === "line",
                          "w-0 border-[1.5px] border-dashed bg-transparent":
                            indicator === "dashed",
                          "my-0.5": tooltipLabel && indicator === "dashed",
                        })}
                        style={{
                          backgroundColor: indicatorColor,
                          borderColor: indicatorColor,
                        }}
                      />
                    )}
                    <div className="flex flex-1 items-center justify-between leading-none">
                      <span className="text-muted-foreground">
                        {itemConfig?.label || item.name}
                      </span>
                      {item.value !== undefined && (
                        <span className="font-mono font-medium tabular-nums text-foreground">
                          {valueLabel}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }
)

ChartTooltipContent.displayName = "ChartTooltip"

const ChartLegend = Legend

type LegendItem = {
  value?: string | number
  dataKey?: string | number
  color?: string
}

type ChartLegendContentProps = React.ComponentProps<"div"> & {
  payload?: LegendItem[]
  verticalAlign?: "top" | "bottom" | "middle"
  hideIcon?: boolean
  nameKey?: string
}

const ChartLegendContent = React.forwardRef<HTMLDivElement, ChartLegendContentProps>(
  (
    { className, hideIcon = false, payload, verticalAlign = "bottom", nameKey },
    ref
  ) => {
    const { config } = useChart()

    if (!payload || payload.length === 0) {
      return null
    }

    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center justify-center gap-4",
          verticalAlign === "top" ? "pb-3" : "pt-3",
          className
        )}
      >
        {payload.map((item, index) => {
          const itemKey = `${nameKey || item.dataKey || "value"}`
          const itemConfig = getPayloadConfigFromPayload(config, item, itemKey)

          return (
            <div
              key={`${item.value || item.dataKey || "legend"}-${index}`}
              className="flex items-center gap-1.5 [&>svg]:size-3 [&>svg]:text-muted-foreground"
            >
              {itemConfig?.icon && !hideIcon ? (
                <itemConfig.icon />
              ) : (
                <div
                  className="h-2 w-2 shrink-0 rounded-[2px]"
                  style={{
                    backgroundColor: item.color,
                  }}
                />
              )}
              {itemConfig?.label}
            </div>
          )
        })}
      </div>
    )
  }
)

ChartLegendContent.displayName = "ChartLegend"

function getPayloadConfigFromPayload(
  config: ChartConfig,
  payload: unknown,
  key: string
) {
  if (!payload || typeof payload !== "object") {
    return undefined
  }

  const payloadRecord = payload as Record<string, unknown>
  const nestedPayload =
    payloadRecord.payload &&
    typeof payloadRecord.payload === "object" &&
    !Array.isArray(payloadRecord.payload)
      ? (payloadRecord.payload as Record<string, unknown>)
      : undefined

  let configLabelKey: string = key

  if (typeof payloadRecord[key] === "string") {
    configLabelKey = payloadRecord[key] as string
  } else if (nestedPayload && typeof nestedPayload[key] === "string") {
    configLabelKey = nestedPayload[key] as string
  }

  return config[configLabelKey] ?? config[key]
}

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
}

export type { TooltipProps }
