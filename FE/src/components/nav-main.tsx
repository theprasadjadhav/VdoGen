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
import type { HistoryType } from "@/types"
import { Link } from "react-router"
import { Alert, AlertTitle } from "./ui/alert"
import { Button } from "./ui/button"
import { useAuth } from "@clerk/clerk-react"
import { baseAxios } from "@/lib/axios"
import { toast } from "sonner"

type NavMainProps = {
  history: HistoryType[],
  setHistory: React.Dispatch<React.SetStateAction<HistoryType[]>>,
  historyError: string | null
}

export function NavMain({ history, setHistory, historyError }: NavMainProps) {
  const { state, setOpen } = useSidebar()
  const [isOpen, setIsOpen] = React.useState(true)
  const { activeConversation, setActiveConversation } = useActiveConversation()
  const { getToken } = useAuth();

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
      const token = await getToken()
      if (!token) {
        throw new Error("You need to be logged in. Please sign in and try again.");
      }
      const response = baseAxios.delete(
        `/conversation/${conversationId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )
      toast.promise((response.then((res) => {
        if (res.data.status === "success") {
          setHistory((prev: HistoryType[]) => prev.filter((c: HistoryType) => c.id !== conversationId))
          setActiveConversation("new")
          return
        } else {
          throw new Error("failed to delete conversation")
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
      const message = error instanceof Error ?  error.message : "Failed to delete Conversation"
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
              className="hover:bg-primary/70 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground min-w-8 duration-200 ease-linear"
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
                className="hover:bg-primary/70 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground min-w-8 duration-200 ease-linear"
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
                className="hover:bg-primary/70 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground min-w-8 duration-200 ease-linear"
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
                      {history.map((item) => (
                        <SidebarMenuItem key={item.id} className="group/item">
                          <div className="flex items-center w-full">
                            <SidebarMenuButton
                              asChild
                              isActive={item.id === activeConversation}
                              onClick={() => {
                                setActiveConversation(item.id)
                              }}
                              className="flex-1"
                            >
                              <div className="flex items-center justify-between w-full">
                                <span className="truncate">{item.firstPrompt}</span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="ml-2 p-1 z-20 cursor-pointer rounded group-hover/item:opacity-100 opacity-0 hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                                  title="Delete"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    deleteConversation(item.id)
                                  }}
                                >
                                  <IconTrash size={16} />
                                </Button>
                              </div>
                            </SidebarMenuButton>

                          </div>
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
