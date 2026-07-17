import { IconAlertCircle, IconCirclePlusFilled, IconHistory, IconMovie, IconTrash } from "@tabler/icons-react"
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
import type { HistoryType } from "@/lib/types"
import { Link } from "react-router"
import { Alert, AlertTitle } from "./ui/alert"
import { Button } from "./ui/button"
// import { useAuth } from "@clerk/clerk-react"
import { baseAxios } from "@/lib/axios"
import { toast } from "sonner"
import { useAuth } from "@/hooks/use-Auth"
import { ConfirmationDialog } from "./ui/confirmation-dialog"

type NavMainProps = {
  history: HistoryType[],
  setHistory: React.Dispatch<React.SetStateAction<HistoryType[]>>,
  historyError: string | null
}

export function NavMain({ history, setHistory, historyError }: NavMainProps) {
  const { state, setOpen } = useSidebar()
  const [isOpen, setIsOpen] = React.useState(true)
  const { activeConversation, setActiveConversation } = useActiveConversation()
  const { user, setUser } = useAuth()


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

  const deleteConversation = async (conversationId: string) => {
    try {

      if (!user) {
        throw new Error('No authentication token available');
      }

      const response = baseAxios.delete(`/content/conversation/${conversationId}`)
      toast.promise((response.then((res) => {
        if (res.status == 200 && res.data?.success && res.data?.status === "success") {
          setHistory((prev: HistoryType[]) => prev.filter((c: HistoryType) => c.id !== conversationId))
          setActiveConversation("new")
          return
        } else if (res.status === 401) {
          setUser(undefined);
          throw new Error("Authentication required. Please log in.")
        } else {
          throw new Error(res.data?.message ?? "failed to delete conversation")
        }
      }).catch((e) => {
        throw e
      }))
        ,
        {
          loading: "Deleting conversation...",
          success: "Conversation deleted successfully.",
          error: "Failed to delete conversation."
        }
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete Conversation"
      toast.error(message)
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
              className="hover:bg-primary/70 hover:cursor-pointer hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground min-w-8 duration-200 ease-linear"
              onClick={() => {
                setActiveConversation("new")
              }}
            >
              <IconCirclePlusFilled />
              <span>New Chat</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {/* video edior button */}
        <SidebarMenu>
          <SidebarMenuItem className="flex items-center gap-2">

            <Link to={"/editor"} className="w-full">
              <SidebarMenuButton
                tooltip="Editor"
                className="hover:bg-primary/70 hover:cursor-pointer hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground min-w-8 duration-200 ease-linear"
              >
                <IconMovie />
                <span>Editor</span>
              </SidebarMenuButton>
            </Link>
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
                className="hover:bg-primary/70 hover:cursor-pointer hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground min-w-8 duration-200 ease-linear"
              >
                <IconHistory />
                <span>History</span>
                <ChevronRight className=" ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
              </SidebarMenuButton>
            </SidebarMenuItem>

            {/* history content */}
            <CollapsibleContent>
              <div className="flex flex-1 flex-col  items-center py-2">
                {
                  historyError ?
                    <Alert variant="destructive">
                      <IconAlertCircle />
                      <AlertTitle>Failed to load history</AlertTitle>
                    </Alert>
                    :
                    <SidebarMenu className="overflow-y-auto flex-1">
                      {history && history.map((item) => (
                        <SidebarMenuItem
                          key={item.id}
                          className="group/item"
                        >
                          <SidebarMenuButton
                            asChild
                            isActive={item.id === activeConversation}
                            className="flex-1"
                          >
                            <div className="flex justify-between w-full">
                              <Button
                                variant="ghost"
                                className="flex-1 px-0 justify-start items-start text-left pl-1 font-normal min-w-0"
                                onClick={() => setActiveConversation(item.id)}
                              >
                                <span className="truncate">{item.firstPrompt}</span>
                              </Button>
                              <ConfirmationDialog
                                trigger={
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="cursor-pointer rounded opacity-0 group-hover/item:opacity-100 group-hover/item:flex group-hover/item:w-auto group-hover/item:h-auto group-hover/item:p-1 group-hover/item:m-0 h-0 w-0 m-0 p-0 overflow-hidden hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-all duration-200"
                                    title="Delete"                               
                                  >
                                    <IconTrash size={16} />
                                  </Button>
                                }
                                title="Delete Conversation"
                                description="Are you sure you want to delete this conversation? This action cannot be undone."
                                onConfirm={() => deleteConversation(item.id)}
                              />
                            </div>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                }
              </div>
            </CollapsibleContent>
          </Collapsible>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
