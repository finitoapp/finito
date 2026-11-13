import Svg, { Circle, Path, Rect, Text as SvgText } from "react-native-svg"
import { useTheme } from "tamagui"

/**
 * The two ways of selling the onboarding asks about (onboarding/0012),
 * drawn as web's `selling-mode-illustrations.tsx` draws them, on the same
 * 160 × 112 grid: fills of the theme's colors and no strokes, as the kit
 * draws no borders, so both read in light and dark.
 */

const viewBox = "0 0 160 112"

/** Rows and columns of the keypad's keys. */
const keyColumns = [64, 80, 96] as const
const keyRows = [44, 57, 70, 83] as const

/** The keypad: a phone with an amount, its keys and the Pay pill. */
export function NumpadIllustration() {
  const theme = useTheme()
  const screen = theme.background.val
  const key = theme["muted-foreground"]?.val
  return (
    <Svg viewBox={viewBox} width="100%" height="100%">
      <Rect x={46} y={2} width={68} height={108} rx={14} fill={screen} />
      <SvgText
        x={80}
        y={30}
        fontSize={18}
        fontWeight="700"
        textAnchor="middle"
        fill={theme.color.val}
      >
        250
      </SvgText>
      {keyRows.map((y) =>
        keyColumns.map((x) => (
          <Circle
            key={`${x}-${y}`}
            cx={x}
            cy={y}
            r={4.5}
            fill={key}
            opacity={0.45}
          />
        ))
      )}
      <Rect
        x={56}
        y={94}
        width={48}
        height={10}
        rx={5}
        fill={theme.primary.val}
      />
    </Svg>
  )
}

/** The bill's item tiles, as its page lays them out; one is being added. */
const itemTiles = [
  { x: 6, y: 14, added: true },
  { x: 42, y: 14, added: false },
  { x: 6, y: 50, added: false },
  { x: 42, y: 50, added: false },
] as const

/** The receipt's item rows: the name's width and the price's. */
const receiptRows = [
  { y: 26, name: 26, price: 12 },
  { y: 38, name: 20, price: 14 },
  { y: 50, name: 30, price: 10 },
] as const

/**
 * The receipt's outline: rounded at the top, torn along the bottom in
 * eight teeth from right to left.
 */
const receiptPath = `M88 16 Q88 10 94 10 H146 Q152 10 152 16 V96 ${"l-4 6 l-4 -6 ".repeat(8)}Z`

/** Bills: item tiles, one being added, and the bill they make beside them. */
export function BillsIllustration() {
  const theme = useTheme()
  const muted = theme["muted-foreground"]?.val
  return (
    <Svg viewBox={viewBox} width="100%" height="100%">
      {itemTiles.map((tile) => (
        <Rect
          key={`${tile.x}-${tile.y}`}
          x={tile.x}
          y={tile.y}
          width={30}
          height={30}
          rx={8}
          fill={tile.added ? theme.primary.val : muted}
          opacity={tile.added ? 1 : 0.3}
        />
      ))}
      <Rect
        x={12}
        y={22}
        width={12}
        height={4}
        rx={2}
        fill={theme["primary-foreground"]?.val}
      />
      <Rect
        x={12}
        y={30}
        width={18}
        height={4}
        rx={2}
        fill={theme["primary-foreground"]?.val}
        opacity={0.6}
      />
      <Path d={receiptPath} fill={theme.background.val} />
      {receiptRows.map((row) => (
        <Rect
          key={row.y}
          x={96}
          y={row.y}
          width={row.name}
          height={5}
          rx={2.5}
          fill={muted}
          opacity={0.5}
        />
      ))}
      {receiptRows.map((row) => (
        <Rect
          key={`price-${row.y}`}
          x={144 - row.price}
          y={row.y}
          width={row.price}
          height={5}
          rx={2.5}
          fill={muted}
          opacity={0.5}
        />
      ))}
      <Rect x={96} y={64} width={48} height={1.5} fill={muted} opacity={0.3} />
      <Rect
        x={96}
        y={72}
        width={20}
        height={7}
        rx={3.5}
        fill={theme.color.val}
      />
      <Rect
        x={122}
        y={72}
        width={22}
        height={7}
        rx={3.5}
        fill={theme.primary.val}
      />
    </Svg>
  )
}
