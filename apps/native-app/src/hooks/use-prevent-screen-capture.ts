import { useEffect } from "react"
import { holdSecureScreen } from "../platform/secure-screen.ts"

/**
 * Keeps the screen out of screenshots, recordings, screen sharing and the
 * recents thumbnail for as long as the calling component is mounted
 * (account/0010). Call it in the component that shows the secret, not in
 * the page around it, so the rest of the screen stays capturable.
 */
export function usePreventScreenCapture(): void {
  useEffect(() => holdSecureScreen(), [])
}
