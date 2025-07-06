import {
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { UserButton, useUser } from "@clerk/clerk-react"

export function NavUser() {
  const { user } = useUser()


  return (
    <SidebarMenu>
      <SidebarMenuItem className="flex items-center justify-between gap-3">
        <UserButton />
        <div className="grid flex-1 text-left text-sm leading-tight">
          <span className="truncate font-medium">{user?.fullName}</span>
          <span className="text-muted-foreground truncate text-xs">
            {user?.primaryEmailAddress?.emailAddress}
          </span>
        </div>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
