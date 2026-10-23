import { useCopyToClipboard } from "@dedalik/use-react"
import { useState } from "react"
import { useGuestStatus } from "./guest-status.tsx"
import { useGuestTranslation } from "./use-guest-translation.ts"

const copyBySelection = (value: string): boolean => {
  const text = document.createElement("span")
  text.textContent = value
  text.style.whiteSpace = "pre"
  text.style.userSelect = "text"
  text.style.webkitUserSelect = "text"
  text.style.position = "fixed"
  text.style.top = "0"
  text.style.clipPath = "inset(50%)"
  document.body.append(text)
  const selection = document.getSelection()
  const range = document.createRange()
  range.selectNodeContents(text)
  selection?.removeAllRanges()
  selection?.addRange(range)
  try {
    return document.execCommand("copy")
  } catch {
    return false
  } finally {
    selection?.removeAllRanges()
    text.remove()
  }
}

export const useGuestClipboard = () => {
  const { t } = useGuestTranslation()
  const announce = useGuestStatus()
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle")
  const [, copyThroughClipboardApi] = useCopyToClipboard()
  const settle = (copied: boolean) => {
    setState(copied ? "copied" : "failed")
    announce(copied ? t("selfPay.copied") : t("selfPay.copy.failed"))
  }
  return {
    state,
    copy: async (value: string) => {
      if (copyBySelection(value)) {
        settle(true)
        return
      }
      settle(await copyThroughClipboardApi(value))
    },
  }
}
