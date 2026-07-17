import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import  { View } from "@/lib/types"
import { IconLogout, IconMoon, IconSun, IconUser, IconVideo } from "@tabler/icons-react"
import { Profile } from "./profile"
import { useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu"
import { Button } from "./ui/button"
import { useTheme } from "../hooks/use-theme"
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip"
import { baseAxios } from "@/lib/axios"
import { useAuth } from "@/hooks/use-Auth"
import { useNavigate } from "react-router"
import { toast } from "sonner"


export function SiteHeader({ view, header }: { view: View, header?:string }) {
  // const { activeConversation } = useActiveConversation()
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const { theme, setTheme } = useTheme()
  const { user, setUser } = useAuth()
  const navigate = useNavigate()

  // function getActiveConvPrompt() {
  //   if (!activeConversation || activeConversation != "new") {
  //     return history?.find(h => h.id == activeConversation)?.firstPrompt
  //   } else {
  //     return "new"
  //   }
  // }

  const signoutHandller = async () => {
    try {
      const res = await baseAxios.get("/auth/signout")

      if (res.data?.success) {
        setUser(undefined)
      } else {
        toast.error(res.data?.message || "Failed to sign out. Please try again.");
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while signing out."
      );
    } finally {
      navigate("/")
    }
  }

  return (
    <header className="sticky top-0 z-50 py-2 flex h-(--header-height) shrink-0 items-center border-b rounded-t-xl bg-background transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-2 px-4">

        {view === View.CHAT ?
          <>
            {/* sidebar trigger */}
            < SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mx-2 data-[orientation=vertical]:h-4"
            />

            {/* hender content */}
            <h1 className="text-base font-medium truncate">{header ? header: ""}</h1>
          </>
          :
          <span className="flex items-center gap-2">
            <IconVideo className="!size-5" />
            <span className="text-base font-semibold">VdoGen</span>
          </span>
        }

        <div className="ml-auto flex items-center">

          {/* mode toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              {theme === "dark" ?
                <Button variant="ghost" size="icon" onClick={() => setTheme("light")}>
                  <IconSun />
                </Button>
                :
                <Button variant="ghost" size="icon" onClick={() => setTheme("dark")}>
                  <IconMoon />
                </Button>
              }
            </TooltipTrigger>
            <TooltipContent>
              <p>Toggle Theme</p>
            </TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />

          {/* profile & logout dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <Avatar onClick={() => setIsProfileOpen(true)}>
                  <AvatarImage src={user?.avatarUrl} alt="@shadcn" />
                  <AvatarFallback>
                    {user?.name
                      ? `${user.name.split(" ")[0][0] ?? ""}${user.name.split(" ").at(-1)?.[0] ?? ""}`.toUpperCase()
                      : "U"}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="bottom" align="start" sideOffset={15} alignOffset={-85}>
              <DropdownMenuItem onClick={() => setIsProfileOpen(true)}>
                <IconUser />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={signoutHandller}>
                <IconLogout />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* profile */}
          <Profile open={isProfileOpen} setOpen={setIsProfileOpen} />
        </div>

      </div>
    </header>
  )
}
