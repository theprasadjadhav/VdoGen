'use client'

import * as React from "react"
import {
    IconBolt,
    IconVideo,
} from "@tabler/icons-react"

import { NavMain } from "@/components/nav-main"
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from "@/components/ui/sidebar"
import type { HistoryType } from "@/lib/types"
import { Badge } from "./ui/badge"
import { useAuth } from "@/hooks/use-Auth"
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip"

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
    history: HistoryType[],
    setHistory: React.Dispatch<React.SetStateAction<HistoryType[]>>,
    historyError: string | null
}

export function AppSidebar({ history, setHistory, historyError, ...props }: AppSidebarProps) {

    const { user } = useAuth()
    const { state } = useSidebar()
    const isCollapsed = state === "collapsed"

    return (
        <Sidebar collapsible="icon"  {...props}>
            {/* Top header */}
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem key="header-logo">
                        <SidebarMenuButton
                            asChild
                            className="data-[slot=sidebar-menu-button]:!p-1.5"
                        >
                            <a href="#">
                                <IconVideo className="!size-5" />
                                <span className="text-base font-semibold">VdoGen</span>
                            </a>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            {/* mid content */}
            <SidebarContent>
                <NavMain history={history} historyError={historyError} setHistory={setHistory} />
            </SidebarContent>

            <SidebarFooter>
                {user && (!user.primeExpiry || (new Date(user.primeExpiry).getTime() < Date.now())) && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="w-full relative">
                                <Badge
                                    title={`${user.useCount} out of 3 credits used`}
                                    data-testid="usage-count"
                                    variant="outline"
                                    className={`
                                        relative flex items-center justify-center gap-1
                                        rounded-full text-xs font-semibold 
                                        bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10
                                        dark:from-primary/20 dark:via-primary/10 dark:to-primary/20
                                        border-primary/20 dark:border-primary/30
                                        shadow-sm hover:shadow-md
                                        transition-all duration-300 ease-in-out
                                        hover:scale-[1.02] hover:from-primary/15 hover:via-primary/10 hover:to-primary/15
                                        dark:hover:from-primary/25 dark:hover:via-primary/15 dark:hover:to-primary/25
                                        overflow-visible
                                        ${isCollapsed
                                            ? 'w-9 h-9 p-0 mb-2 mx-auto'
                                            : 'w-full py-2.5 mb-2 px-4'
                                        }
                                    `}
                                >
                                    {isCollapsed ? (
                                        <>
                                            <IconBolt
                                                size={20}
                                                className="!w-4 !h-4 text-yellow-500 dark:text-yellow-400 transition-all duration-300"
                                            />
                                            <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shadow-lg ring-2 ring-background dark:ring-sidebar z-10">
                                                { 3 - user.useCount}
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="text-base font-bold text-primary tabular-nums transition-all duration-300  delay-100">
                                                {3 - user.useCount}
                                            </span>
                                            <span className="text-xs text-muted-foreground font-normal transition-all duration-300  delay-100">
                                                / 3 free credits remaining
                                            </span>
                                            <IconBolt
                                                className="!w-4 !h-4 text-yellow-500 dark:text-yellow-400 transition-all duration-300 ml-auto"
                                            />
                                        </>
                                    )}
                                </Badge>

                            </div>
                        </TooltipTrigger>
                        {isCollapsed && (
                            <TooltipContent side="right" align="center" sideOffset={8}>
                                <div className="flex flex-col gap-1">
                                    <span className="font-semibold">{3 - user.useCount} / 3 Free credits remaining</span>
                                </div>
                            </TooltipContent>
                        )}
                    </Tooltip>
                )}
            </SidebarFooter>

        </Sidebar>
    )
}
