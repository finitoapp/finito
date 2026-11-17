/**
 * The kit's `transition`: the `fast` preset (`animations.ts`, CSS on the PWA)
 * on the fill, the text color and the opacity only, which is every state a
 * kit control fades between. Not the bare preset, which covers every
 * property: a kit `Button` carries a height and radii and border widths, so
 * each state change animated eleven or twelve values, every frame, on the
 * JS thread. On a PAX A920Pro one tap on Charge started some 57 such
 * animations, a quarter of the JS work of the navigation behind it
 * (2026-11-17). The fades still run on the JS driver (`animations.ts`
 * explains why), three values each. `ui-kit.test.ts` fails on a bare
 * `"fast"`.
 */
export const fadeTransition = "background-color fast, color fast, opacity fast"
