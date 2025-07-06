import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { ModeToggle } from "./mode-toggle"
import { useActiveConversation } from "@/hooks/use-active-conversation"
import type { HistoryType } from "@/types"

export function SiteHeader({history}: {history:HistoryType[]}) {

  const { activeConversation } = useActiveConversation()

  function getactiveConvPrompt() {
    if (!activeConversation || activeConversation != "new") {
      return history.find(h => h.id == activeConversation)?.firstPrompt
    } else {
      return "new"
    }
  }

  return (
    <header className="sticky top-0 z-50 py-2 flex h-(--header-height) shrink-0 items-center border-b rounded-t-xl bg-background transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-2 px-4">

        {/* sidebar trigger */}
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />

        {/* hender content */}
        <h1 className="text-base font-medium truncate">{getactiveConvPrompt()}</h1>

        {/* mode toggle */}
        <div className="ml-auto flex items-center">
          <Separator
            orientation="vertical"
            className="mx-2 data-[orientation=vertical]:h-4"
          />
          <ModeToggle />
        </div>

      </div>
    </header>
  )
}
