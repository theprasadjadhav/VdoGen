import { useAuth, useUser } from "@clerk/clerk-react";
import { Badge } from "./ui/badge";
import { Link } from "react-router";
import { Button } from "./ui/button";
import { IconBolt } from "@tabler/icons-react";


export function PlanBadge() {

    const { user } = useUser()
    const { has, isLoaded } = useAuth()

    return (
        <>
            {isLoaded && has({ plan: 'premium_user' }) ?

                <Badge
                    title="Premium user"
                    data-testid="usage-count"
                    variant="outline"
                    className="flex items-center gap-1 mx-3 py-2 rounded-full text-xs font-semibold bg-gradient-to-r from-indigo-500 to-purple-600 shadow-sm"
                >
                    <span>Primium</span>
                </Badge>

                :

                <div className="flex items-center gap-2 mx-3">
                    <Badge
                        title="Free users can generate up to 3 videos"
                        data-testid="usage-count"
                        variant="outline"
                        className="flex items-center gap-1 py-1 px-3 rounded-full text-xs font-semibold bg-primary/10 dark:bg-primary/20 shadow-sm"
                    >
                        {user && typeof user.publicMetadata?.usageCount === "number"
                            && (
                                <span className="flex items-center font-bold text-primary">
                                    <span className="text-base">
                                        {Math.max(0, 3 - (user.publicMetadata.usageCount as number))}
                                    </span>
                                    <IconBolt size={16} className="ml-1 text-yellow-400" />
                                </span>
                            )
                        }
                    </Badge>
                    <Link
                        to="/pricing"
                        className="inline-block ml-1"
                        tabIndex={-1}
                    >
                        <Button
                            className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white px-3 py-1 rounded-full text-xs font-semibold shadow transition-colors duration-150"
                            style={{ outline: 'none' }}
                        >
                            Upgrade
                        </Button>
                    </Link>
                </div>
            }

        </>
    )
}