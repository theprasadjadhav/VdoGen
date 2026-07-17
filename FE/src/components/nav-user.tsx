import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { useAuth } from "@/hooks/use-Auth";
// import { UserButton, useUser } from "@clerk/clerk-react"

import { IconCoin } from "@tabler/icons-react"
import { Link } from 'react-router';

export function NavUser() {
  // const { user } = useUser()
  const { user } = useAuth()
  const { state } = useSidebar()

  return (
    <SidebarMenu>
      <SidebarMenuItem className="flex items-center justify-between gap-3">
        <Link
          to={"/pricing"}
          className="w-full"
        >
          <SidebarMenuButton
            tooltip="Pricing"
            className="bg-primary text-center text-primary-foreground hover:bg-accent hover:text-accent-foreground min-w-8 duration-200 mb-3 ease-linear"
            onClick={() => {

            }}
          >
            {state === "collapsed" ? <IconCoin /> : <></>}
            <div className="flex-1 text-center">Pricing</div>
          </SidebarMenuButton>
        </Link>
      </SidebarMenuItem>
      <SidebarMenuItem className="flex items-center justify-between gap-3">
        {/* <UserButton /> */}
        <div className="grid flex-1 text-left text-sm leading-tight">
          <span className="truncate font-medium">{user?.name}</span>
          <span className="text-muted-foreground truncate text-xs">
            {user?.email}
          </span>
        </div>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
