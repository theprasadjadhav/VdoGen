'use client'

import * as React from "react"
import {
  IconVideo,
} from "@tabler/icons-react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import type { HistoryType } from "@/types"

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  history: HistoryType[],
  setHistory: React.Dispatch<React.SetStateAction<HistoryType[]>>,
  historyError: string | null
}

export function AppSidebar({ history,setHistory, historyError, ...props }: AppSidebarProps) {
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
                <NavMain history={history} historyError={historyError} setHistory={setHistory}/>
            </SidebarContent>

            {/* footer */}
            <SidebarFooter>
                <NavUser/>
            </SidebarFooter>

        </Sidebar>
    )
}
