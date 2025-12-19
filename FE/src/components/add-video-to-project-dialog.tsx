import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@clerk/clerk-react";
import { baseAxios } from "@/lib/axios";
import { toast } from "sonner";
import type { ContentType, projectType } from "@/types";
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Checkbox } from "./ui/checkbox";
import { IconFolderPlus } from "@tabler/icons-react";

const FormSchema = z.object({
    projectIds: z.array(z.string())
});

type AddVideoToProjectDialogProps = {
    contentItem: ContentType;
    onVideoAdded: (contentId: string, projectIds: string[]) => void;
};

export function AddVideoToProjectDialog({ contentItem, onVideoAdded }: AddVideoToProjectDialogProps) {
    const [projects, setProjects] = useState<projectType[] | null>(null);
    const { getToken } = useAuth();

    const form = useForm<z.infer<typeof FormSchema>>({
        resolver: zodResolver(FormSchema),
        defaultValues: {
            projectIds: []
        }
    });

    const handleDialogOpen = () => {
        if (contentItem.editorProject) {
            const initialProjectIds = contentItem.editorProject.map(project => project.id);
            form.setValue('projectIds', initialProjectIds);
        } else {
            form.setValue('projectIds', []);
        }
    };

    async function onSubmit(data: z.infer<typeof FormSchema>) {
        const token = await getToken();

        if (!token) {
            toast.error("You need to be logged in. Please sign in and try again.");
            return;
        }

        const promise = baseAxios.post("/project/add-video", {
            projectIds: data.projectIds,
            videoId: contentItem.id
        }, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        toast.promise(promise.then((res) => {
            if (res.status == 200) {
                onVideoAdded(contentItem.id, data.projectIds);
                return data;
            } else {
                throw new Error();
            }
        }),
            {
                loading: "Updating your project(s)...",
                success: () => "video has been updated in your selected project(s) successfully",
                error: "Oops! Something went wrong. Please try again."
            }
        );
    }

    useEffect(() => {
        async function getProjects() {
            try {
                const token = await getToken();

                if (!token) {
                    throw new Error("unauthenticated");
                }

                const res = await baseAxios.get("/project", {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });

                if (res.status != 200) {
                    throw new Error("failed to fetch projects");
                }

                const projects: projectType[] = res.data;
                setProjects(projects);
            } catch (e) {
                toast.error(e instanceof Error ? e.message : "An error occurred while fetching projects");
            }
        }

        getProjects();
    }, [getToken]);

    return (
        <>
            <Dialog>
                <DialogTrigger asChild>
                    <Button
                        size={"sm"}
                        variant={"ghost"}
                        className="hover:cursor-pointer"
                        onClick={handleDialogOpen}
                        title="Add video to project"

                    >
                        <IconFolderPlus color="grey" />
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Select project(s).</DialogTitle>
                    </DialogHeader>
                    <DialogDescription>
                        Choose one or more projects to add this video to.
                    </DialogDescription>
                    <div className="flex flex-col gap-2">
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                                <FormField
                                    control={form.control}
                                    name="projectIds"
                                    render={({ field }) => (
                                        <FormItem>
                                            {projects && projects.length > 0 ? (
                                                projects.map((project) => (
                                                    <FormItem
                                                        key={project.id}
                                                        className="flex flex-row items-center gap-2"
                                                    >
                                                        <FormControl>
                                                            <Checkbox
                                                                checked={field.value?.includes(project.id)}
                                                                onCheckedChange={(checked) => {
                                                                    if (checked) {
                                                                        field.onChange([...(field.value || []), project.id]);
                                                                    } else {
                                                                        field.onChange((field.value || []).filter((id) => id !== project.id));
                                                                    }
                                                                }}
                                                            />
                                                        </FormControl>
                                                        <FormLabel className="text-sm font-normal">
                                                            {project.name}
                                                        </FormLabel>
                                                    </FormItem>
                                                ))
                                            ) : (
                                                <div className="text-muted-foreground text-sm">No projects found.</div>
                                            )}
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <DialogFooter>

                                    {projects && projects.length > 0 && <DialogClose asChild>
                                        <Button type="submit">Update</Button>
                                    </DialogClose>
                                    }
                                </DialogFooter>
                            </form>
                        </Form>
                    </div>
                </DialogContent>
            </Dialog >
        </>
    );
}
