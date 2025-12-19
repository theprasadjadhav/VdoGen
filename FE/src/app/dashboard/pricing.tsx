import { PricingTable } from "@clerk/clerk-react"
import { Link } from "react-router"
import { Button } from "../../components/ui/button"
import { IconChevronLeft } from "@tabler/icons-react"
import { SiteHeader } from "../../components/site-header"


export function Pricing() {
  return (
    <div className="h-full w-full flex flex-col">
      <SiteHeader />
      <div className="flex flex-col items-center bg-gradient-to-br h-full from-background to-muted/60 py-18 px-8">
        <div className="flex w-full justify-between items-center">
          <Link to={"/chat"}>
            <Button
              variant={"ghost"}
              className="flex items-center gap-2 text-muted-foreground hover:text-primary"
            >
              <IconChevronLeft size={22} />
              <span className="text-base font-medium">Back To Chat</span>
            </Button>
          </Link>
        </div>

        <div className="flex-1 flex justify-center items-center w-[80%]">
          <PricingTable/>
          
        </div>
      </div>
    </div>




  )
}


