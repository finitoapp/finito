import type { Locator } from "@playwright/test"

type Rgb = readonly [number, number, number]

export type ColorLayer = "color" | "border-top-color" | "background"

export async function effectiveColor(
  locator: Locator,
  layer: ColorLayer
): Promise<Rgb> {
  return locator.evaluate((element, property): Rgb => {
    const canvas = document.createElement("canvas")
    canvas.width = 1
    canvas.height = 1
    const context = canvas.getContext("2d", { willReadFrequently: true })
    if (context === null) throw new Error("Expected a 2D canvas.")
    const rgba = (css: string): readonly [number, number, number, number] => {
      context.clearRect(0, 0, 1, 1)
      context.fillStyle = "rgb(1, 2, 3)"
      context.fillStyle = css
      if (context.fillStyle === "#010203" && css !== "rgb(1, 2, 3)") {
        throw new Error(`The canvas cannot read the color ${css}.`)
      }
      context.fillRect(0, 0, 1, 1)
      const [red = 0, green = 0, blue = 0, alpha = 0] = context.getImageData(
        0,
        0,
        1,
        1
      ).data
      return [red, green, blue, alpha / 255]
    }
    const over = (
      top: readonly [number, number, number, number],
      bottom: Rgb
    ): Rgb => [
      top[0] * top[3] + bottom[0] * (1 - top[3]),
      top[1] * top[3] + bottom[1] * (1 - top[3]),
      top[2] * top[3] + bottom[2] * (1 - top[3]),
    ]
    const backgrounds: Array<readonly [number, number, number, number]> = []
    for (
      let node: Element | null = element;
      node !== null;
      node = node.parentElement
    ) {
      const background = rgba(getComputedStyle(node).backgroundColor)
      if (background[3] > 0) backgrounds.unshift(background)
      if (background[3] === 1) break
    }
    const behind = backgrounds.reduce<Rgb>(
      (color, background) => over(background, color),
      [255, 255, 255]
    )
    return property === "background"
      ? behind
      : over(rgba(getComputedStyle(element).getPropertyValue(property)), behind)
  }, layer)
}

const relativeLuminance = (rgb: Rgb): number => {
  const [red, green, blue] = rgb.map((channel) => {
    const value = channel / 255
    return value <= 0.040_45 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * (red ?? 0) + 0.7152 * (green ?? 0) + 0.0722 * (blue ?? 0)
}

export async function colorContrast(
  first: readonly [Locator, ColorLayer],
  second: readonly [Locator, ColorLayer]
): Promise<number> {
  const [lighter, darker] = [
    relativeLuminance(await effectiveColor(...first)),
    relativeLuminance(await effectiveColor(...second)),
  ].sort((left, right) => right - left)
  return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05)
}
