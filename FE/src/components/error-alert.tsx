import { IconAlertCircle } from "@tabler/icons-react";
import { Alert, AlertTitle } from "./ui/alert";


export default function ErrorAlert({message}:{message:string}) {
    return (
        <div className="flex items-center justify-center h-full">
            <Alert variant="destructive" className="max-w-lg mx-auto">
                <IconAlertCircle className="h-5 w-5 mr-2" />
                <AlertTitle>{message}</AlertTitle>

            </Alert>
        </div>
    )
}