import { useRouter } from "@tanstack/react-router"
import { ArrowLeftIcon } from "lucide-react"
import { type FC, type ReactNode, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button.tsx"
import { useTranslation } from "@/hooks/use-translation.ts"
import { cn } from "@/lib/utils.ts"

export const FadeHeader: FC<{
  title?: ReactNode
  endAddon?: React.ReactNode
  startAddon?: React.ReactNode | null
  customStartAddonOnClick?: () => void
  /** Widens the bar past the phone column, for a page that does too. */
  className?: string
}> = (props) => {
  const divRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const { t } = useTranslation()

  useEffect(() => {
    const handleScroll = () => {
      // Fade out completely after scrolling fadeDistance px
      const scrollY = window.scrollY
      const fadeDistance = 75
      const newOpacity = Math.max(0, 1 - scrollY / fadeDistance)

      if (divRef.current) {
        divRef.current.style.opacity = newOpacity.toString()
        divRef.current.style.top = `calc(env(safe-area-inset-top) + var(--terminal-banner-height, 0px) + ${(0 - scrollY / 2.5).toString()}px)`
      }
    }

    handleScroll()
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const startAddon =
    props.startAddon === undefined ? (
      <Button
        type={"button"}
        variant={"ghost"}
        aria-label={t("nav.back")}
        onClick={props.customStartAddonOnClick ?? (() => router.history.back())}
      >
        <ArrowLeftIcon className={"text-primary size-5"} strokeWidth={3} />
      </Button>
    ) : (
      props.startAddon
    )

  return (
    <div
      ref={divRef}
      className="text-center fixed left-0 right-0 lg:pl-(--menu-sidebar-width)"
      style={{
        opacity: 1,
        top: "calc(env(safe-area-inset-top) + var(--terminal-banner-height, 0px))",
      }}
    >
      <div className="relative flex flex-row w-full justify-center">
        <div
          className={cn(
            "max-w-xl px-4 py-3 flex flex-1 flex-row justify-between gap-4",
            props.className
          )}
        >
          <div className={"w-10"}>{startAddon}</div>
          <h2 className="flex-1 shrink text-xl font-bold text-foreground m-auto">
            {props.title}
          </h2>
          <div className={"w-10"}>{props.endAddon}</div>
        </div>
      </div>
    </div>
  )
}
