export const interpolate = (
  text: string,
  params: Readonly<Record<string, string | number>>
): string =>
  text.replace(/\{([^{}]+)\}/gu, (placeholder, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : placeholder
  )
