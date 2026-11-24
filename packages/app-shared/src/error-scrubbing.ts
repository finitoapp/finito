/**
 * The policy both apps apply before an error report leaves the device:
 * recovery phrases, IBANs, Cashu tokens and hex secrets are redacted from
 * events and breadcrumbs, and clicks inside the PIN keypad are not recorded.
 * Written against structural shapes so neither Sentry SDK is imported here;
 * the SDK wiring stays in each app. Debug console output that is copied,
 * exported or sent passes the same `scrubText` (settings/0006).
 */

const SENSITIVE_TEXT_PATTERNS: ReadonlyArray<RegExp> = [
  // Cashu tokens (NUT-00 `cashuA`, `cashuB`) carry spendable proofs. First,
  // so the whole token goes before the patterns below take a piece of it.
  /\bcashu[AB][A-Za-z0-9_\-+/=]{20,}/g,
  // Recovery phrases: 11 or more consecutive lowercase words.
  /(?:\b[a-z]+\b[ \t]+){11,}\b[a-z]+\b/g,
  // IBAN-like bank account numbers.
  /\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/g,
  // Hex secrets: a master key or a transfer session secret (32), an
  // ephemeral Nostr key (64).
  /\b[0-9a-fA-F]{32,}\b/g,
]

/** Redacts every sensitive pattern above from a piece of free text. */
export function scrubText(text: string): string {
  return SENSITIVE_TEXT_PATTERNS.reduce(
    (result, pattern) => result.replace(pattern, "[redacted]"),
    text
  )
}

function scrubValue(value: unknown, depth: number): unknown {
  if (depth > 4) {
    return value
  }

  if (typeof value === "string") {
    return scrubText(value)
  }

  if (Array.isArray(value)) {
    return value.map((item) => scrubValue(item, depth + 1))
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [
        key,
        scrubValue(entryValue, depth + 1),
      ])
    )
  }

  return value
}

/**
 * Marks the PIN keypad (access/0006). Sentry's `ui.*` breadcrumbs record the
 * clicked element's selector, so a click inside it could spell out the PIN;
 * the marker, not the route, decides, since the one-shot prompt is a dialog
 * over another route. Web only: native records no `ui.*` DOM breadcrumbs.
 */
export const pinPadAttribute = "data-pin-pad"

interface ClosestTarget {
  readonly closest: (selector: string) => unknown
}

const isInsidePinPad = (
  hint: { readonly event?: { readonly target?: unknown } } | undefined
): boolean => {
  const target: unknown = hint?.event?.target
  return (
    typeof target === "object" &&
    target !== null &&
    "closest" in target &&
    typeof target.closest === "function" &&
    (target as ClosestTarget).closest(`[${pinPadAttribute}]`) !== null
  )
}

interface ScrubbableBreadcrumb {
  readonly category?: string | undefined
  readonly message?: string | undefined
  readonly data?: unknown
}

export function scrubBreadcrumb<B extends ScrubbableBreadcrumb>(
  breadcrumb: B,
  hint?: { readonly event?: { readonly target?: unknown } }
): B | null {
  if (breadcrumb.category?.startsWith("ui.") === true && isInsidePinPad(hint)) {
    return null
  }
  return {
    ...breadcrumb,
    message:
      breadcrumb.message === undefined
        ? undefined
        : scrubText(breadcrumb.message),
    data:
      breadcrumb.data === undefined
        ? undefined
        : scrubValue(breadcrumb.data, 0),
  }
}

interface ScrubbableEvent {
  readonly message?: string | undefined
  readonly exception?:
    | {
        readonly values?:
          | ReadonlyArray<{ readonly value?: string | undefined }>
          | undefined
      }
    | undefined
  readonly extra?: unknown
  readonly contexts?: { readonly trace?: unknown } | undefined
}

export function scrubEvent<E extends ScrubbableEvent>(event: E): E {
  return {
    ...event,
    message: event.message === undefined ? undefined : scrubText(event.message),
    exception:
      event.exception === undefined
        ? undefined
        : {
            ...event.exception,
            values: event.exception.values?.map((exceptionValue) => ({
              ...exceptionValue,
              value:
                exceptionValue.value === undefined
                  ? undefined
                  : scrubText(exceptionValue.value),
            })),
          },
    extra: event.extra === undefined ? undefined : scrubValue(event.extra, 0),
    // `trace` holds hex ids Sentry needs intact, and nothing of ours.
    contexts:
      event.contexts === undefined
        ? undefined
        : {
            ...(scrubValue(event.contexts, 0) as object),
            trace: event.contexts.trace,
          },
  }
}
