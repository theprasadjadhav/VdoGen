import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { baseAxios } from "@/lib/axios"
import type { ProjectType } from "@/lib/types"
import { IconPlus } from "@tabler/icons-react"
import { useRef } from "react"
import { toast } from "sonner"
import { useAuth } from '@/hooks/use-Auth';

export function ProjectCreateDialog({ setProjects }: { setProjects: React.Dispatch<React.SetStateAction<ProjectType[] | null>> }) {

    const { user,setUser } = useAuth()
    const inputBoxRef = useRef<HTMLInputElement | null>(null)

    async function createProject() {
        try {
            
            if (!user) {
                throw new Error('No authentication token available');
            }

            const projectName = inputBoxRef.current?.value || ""

            const response = await baseAxios.post("/project",{ 
                projectName 
            })
            if (response.status === 401) {
                setUser(undefined);
                throw new Error ("Authentication required. Please log in.")
            }
            if (response.status != 200) {
                throw new Error(response.data?.message ?? "Failed to create project")
            }
            const createdProject: ProjectType = response.data.project
            setProjects(prev => prev ? [...prev, createdProject] : [createdProject])

        } catch (e) {
            const message = e instanceof Error ? e.message : "Unable to create project: unexpected error"
            toast.error(message)
        }
    }

    

    return (
        <Dialog>
            <form>
                <DialogTrigger asChild>
                    <IconPlus className="cursor-pointer" />
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Create Project</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4">
                        <div className="grid gap-3">
                            <Label htmlFor="name-1">Name</Label>
                            <Input ref={inputBoxRef} id="name-1" name="name" />
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button className="cursor-pointer" variant="outline">Cancel</Button>
                        </DialogClose>
                        <DialogClose asChild>
                            <Button className="cursor-pointer" onClick={createProject}>Create</Button>
                        </DialogClose>
                    </DialogFooter>
                </DialogContent>
            </form>
        </Dialog>
    )
}
