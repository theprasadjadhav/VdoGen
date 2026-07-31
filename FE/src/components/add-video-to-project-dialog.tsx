import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
// import { useAuth } from "@clerk/clerk-react";
import { baseAxios } from "@/lib/axios";
import { toast } from "sonner";
import type { ContentType, ProjectType } from "@/lib/types";
import { Button } from '@/components/ui/button';
import { AddVideoToProjectFormSchema as FormSchema } from "@/lib/schema";
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
import { IconFolderPlus, IconFolder, IconFolderCheck } from "@tabler/icons-react";
import { useAuth } from "@/hooks/use-Auth";

type AddVideoToProjectDialogProps = {
    contentItem: ContentType;
    onVideoAdded: (contentId: string, projectIds: string[]) => void;
};

export function AddVideoToProjectDialog({ contentItem, onVideoAdded }: AddVideoToProjectDialogProps) {
    const [projects, setProjects] = useState<ProjectType[] | null>(null);
    const { user, setUser } = useAuth()

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

        if (!user) {
            throw new Error('No authentication token available');
        }

        const promise = baseAxios.post("/project/add-video", {
            projectIds: data.projectIds,
            videoId: contentItem.id
        });

        toast.promise(promise.then((res) => {
            if (res.status == 200) {
                onVideoAdded(contentItem.id, data.projectIds);
                return data;
            }
            else if (res.status === 401) {
                setUser(undefined);
                throw new Error("Authentication required. Please log in.")
            } else {
                throw new Error("Oops! Something went wrong. Please try again.");
            }
        }),
            {
                loading: "Updating your project(s)...",
                success: () => "video has been updated in your selected project(s) successfully",
                error: (e) => e instanceof Error ? e.message : "An error occurred while updating your project(s)",
            }
        );
    }

    useEffect(() => {
        async function getProjects() {
            try {

                if (!user) {
                    throw new Error('No authentication token available');
                }

                const res = await baseAxios.get("/project");

                if (res.status === 401) {
                    setUser(undefined);
                    throw new Error ("Authentication required. Please log in.")
                }

                if (res.status != 200 || !res.data.success) {
                    throw new Error("failed to fetch projects");
                }

                const projects: ProjectType[] = res.data.projects;
                setProjects(projects);
            } catch (e) {
                toast.error(e instanceof Error ? e.message : "An error occurred while fetching projects");
            }
        }

        getProjects();
    }, [user]);

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/[0.06] cursor-pointer"
                    onClick={handleDialogOpen}
                    title="Add to project"
                >
                    <IconFolderPlus className="h-4 w-4" />
                </Button>
            </DialogTrigger>

            <DialogContent className="w-full sm:max-w-[400px] bg-white dark:bg-[#0d0d0d] border border-zinc-200 dark:border-white/[0.08] shadow-sm dark:shadow-[0_25px_60px_rgba(0,0,0,0.6)] p-0">
                <DialogHeader className="px-5 pt-5 pb-4 border-b border-zinc-200 dark:border-white/[0.06]">
                    <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-lg bg-[#6366f1]/10 flex items-center justify-center flex-shrink-0">
                            <IconFolderPlus className="h-4 w-4 text-[#6366f1]" />
                        </div>
                        <div>
                            <DialogTitle className="text-base font-semibold text-zinc-900 dark:text-zinc-100 leading-tight">
                                Add to project
                            </DialogTitle>
                            <DialogDescription className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                Choose projects for this video
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)}>
                        <div className="px-5 py-4 max-h-64 overflow-y-auto">
                            <FormField
                                control={form.control}
                                name="projectIds"
                                render={({ field }) => (
                                    <FormItem className="space-y-1">
                                        {projects === null ? (
                                            <div className="flex items-center justify-center py-6 text-sm text-zinc-400 dark:text-zinc-500">
                                                Loading projects...
                                            </div>
                                        ) : projects.length > 0 ? (
                                            projects.map((project) => {
                                                const isChecked = field.value?.includes(project.id);
                                                return (
                                                    <FormItem key={project.id} className="flex items-center gap-3 m-0">
                                                        <label
                                                            className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                                                                isChecked
                                                                    ? "bg-[#6366f1]/[0.08] dark:bg-[#6366f1]/[0.1]"
                                                                    : "hover:bg-zinc-100 dark:hover:bg-white/[0.04]"
                                                            }`}
                                                        >
                                                            <FormControl>
                                                                <Checkbox
                                                                    checked={isChecked}
                                                                    onCheckedChange={(checked) => {
                                                                        if (checked) {
                                                                            field.onChange([...(field.value || []), project.id]);
                                                                        } else {
                                                                            field.onChange((field.value || []).filter((id) => id !== project.id));
                                                                        }
                                                                    }}
                                                                    className="border-zinc-300 dark:border-white/[0.2] data-[state=checked]:bg-[#6366f1] data-[state=checked]:border-[#6366f1]"
                                                                />
                                                            </FormControl>
                                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                                                {isChecked
                                                                    ? <IconFolderCheck className="h-4 w-4 text-[#6366f1] flex-shrink-0" />
                                                                    : <IconFolder className="h-4 w-4 text-zinc-400 dark:text-zinc-500 flex-shrink-0" />
                                                                }
                                                                <FormLabel className={`text-sm cursor-pointer truncate ${
                                                                    isChecked
                                                                        ? "font-medium text-[#6366f1] dark:text-[#a78bfa]"
                                                                        : "font-normal text-zinc-700 dark:text-zinc-300"
                                                                }`}>
                                                                    {project.name}
                                                                </FormLabel>
                                                            </div>
                                                        </label>
                                                    </FormItem>
                                                );
                                            })
                                        ) : (
                                            <div className="flex flex-col items-center justify-center py-8 gap-2">
                                                <IconFolder className="h-8 w-8 text-zinc-300 dark:text-zinc-600" />
                                                <p className="text-sm text-zinc-400 dark:text-zinc-500">No projects yet</p>
                                            </div>
                                        )}
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <DialogFooter className="px-5 py-4 border-t border-zinc-200 dark:border-white/[0.06] flex gap-2">
                            <DialogClose asChild>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="flex-1 bg-transparent border-zinc-200 dark:border-white/[0.08] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/[0.06]"
                                >
                                    Cancel
                                </Button>
                            </DialogClose>
                            {projects && projects.length > 0 && (
                                <DialogClose asChild>
                                    <Button
                                        type="submit"
                                        className="flex-1 bg-[#6366f1] hover:bg-[#5558e8] text-white transition-colors"
                                    >
                                        Update
                                    </Button>
                                </DialogClose>
                            )}
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
