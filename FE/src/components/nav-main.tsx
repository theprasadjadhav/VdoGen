import { IconCirclePlusFilled, IconHistory } from "@tabler/icons-react"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible"
import { ChevronRight } from "lucide-react"
import React, { useEffect } from "react"
import { useActiveConversation } from "@/hooks/use-active-conversation"
import type { HistoryType } from "@/types"




export function NavMain({history}:{history:HistoryType[]}) {
  const { state, setOpen } = useSidebar()
  const [isOpen, setIsOpen] = React.useState(true)
  const { activeConversation, setActiveConversation } = useActiveConversation()


  useEffect(() => {
    if (state === "collapsed") {
      setIsOpen(false)
    }
  }, [state])

  function toggleCollapsible() {
    if (state === "collapsed") {
      setOpen(true)
      setIsOpen(true)
    } else {
      setIsOpen((isOpen) => !isOpen)
    }
  }

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">

        {/* new chat button */}
        <SidebarMenu>
          <SidebarMenuItem className="flex items-center gap-2">
            <SidebarMenuButton
              tooltip="New Chat"
              className="hover:bg-primary/70 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground min-w-8 duration-200 ease-linear"
              onClick={()=>{setActiveConversation("new")}}
            >
              <IconCirclePlusFilled />
              <span>New Chat</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {/* collapsible History */}
        <SidebarMenu>

          <Collapsible
            open={isOpen}
            onOpenChange={setIsOpen}
            className="group/collapsible"
          >
            {/* history button */}
            <SidebarMenuItem className="flex items-center gap-2 ">
              <SidebarMenuButton
                tooltip="History"
                onClick={toggleCollapsible}
                className="hover:bg-primary/70 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground min-w-8 duration-200 ease-linear"
              >
                <IconHistory />
                <span>History</span>
                <ChevronRight className=" ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
              </SidebarMenuButton>
            </SidebarMenuItem>

            {/* history content */}
            <CollapsibleContent>
              <div className="flex flex-1 flex-col items-center py-2">
                <SidebarMenu className="overflow-y-auto flex-1">
                  {history.map((item) => (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton 
                        asChild 
                        isActive={item.id === activeConversation} 
                        onClick={() => setActiveConversation(item.id)} 
                        className="cursor-pointer"
                      >
                        <div className="flex items-center">
                          <span className="truncate">{item.firstPrompt}</span>
                        </div>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </div>
            </CollapsibleContent>

          </Collapsible>
        </SidebarMenu>

      </SidebarGroupContent>
    </SidebarGroup>
  )
}
