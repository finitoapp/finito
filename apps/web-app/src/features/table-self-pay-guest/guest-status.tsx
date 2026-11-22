import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useState,
} from "react"

const GuestStatusContext = createContext<(message: string) => void>(
  () => undefined
)

export const useGuestStatus = () => use(GuestStatusContext)

export function GuestStatusRegion({
  children,
}: {
  readonly children: ReactNode
}) {
  const [status, setStatus] = useState({ message: "", count: 0 })
  const announce = useCallback((message: string) => {
    setStatus(({ count }) => ({ message, count: count + 1 }))
  }, [])

  return (
    <GuestStatusContext value={announce}>
      {children}
      <p role="status" className="sr-only">
        <span key={status.count}>{status.message}</span>
      </p>
    </GuestStatusContext>
  )
}
