import { baseAxios } from "@/lib/axios"
import { View, type ProjectType } from "@/lib/types"
// import { useAuth } from "@clerk/clerk-react"
import { useEffect, useState } from "react"
import { Button } from "../../components/ui/button"
import { IconChevronLeft, IconCircleMinus } from "@tabler/icons-react"
import { ProjectCreateDialog } from "../../components/project-create-Dialog"
import Editor from "../../components/editor"
import { toast } from "sonner"
import { ConfirmationDialog } from "../../components/ui/confirmation-dialog"
import { Link } from 'react-router';
import { SiteHeader } from "@/components/site-header"
import { ProjectSkeleton } from "@/components/skeleton/project-skeleton"
import ErrorAlert from '../../components/error-alert';
import { useAuth } from "@/hooks/use-Auth"

export function Project() {
    const [projects, setProjects] = useState<ProjectType[] | null>(null)
    const [selectedProject, setSelectedProject] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const { user, setUser } = useAuth()

    async function deleteProject(projectId: string): Promise<void> {

        try {
            
            if (!user) {
                throw new Error('No authentication token available');
            }

            const response = await baseAxios.delete(`/project/${projectId}`)

            if (response.status === 401) {
                setUser(undefined);
                throw new Error ("Authentication required. Please log in.")
            }
            if (response.status !== 200 && response.status !== 204) {
                throw new Error("Failed to delete project")
            }

            setProjects(prev =>
                prev ? prev.filter(project => project.id !== projectId) : prev
            )

        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : "Failed to delete project"
            setError(errorMessage)
        }
    }


    useEffect(() => {
        async function getAllProjects() {
            setLoading(true)
            try {
                if (!user) {
                    throw new Error('No authentication token available');
                }
                const response = await baseAxios.get(`/project`)

                if (response.status === 401) {
                    setUser(undefined);
                    throw new Error ("Authentication required. Please log in.")
                }
                if (response.status != 200) {
                    throw new Error("Internal server error: Failed to fetch Projects")
                }

                const projects: ProjectType[] = response.data.projects

                setProjects(projects)
                setError(null)
            } catch (e) {
                const errorMessage = e instanceof Error ? e.message : "Failed to fetch Projects"
                setError(errorMessage)
                setProjects(null)
            } finally {
                setLoading(false)
            }
        }

        getAllProjects()

    }, [])

    if (loading) {
        return <ProjectSkeleton />
    }

    return (
        <div className="h-full w-full flex flex-col">

            <SiteHeader view={View.EDITOR} />

            {selectedProject ? <Editor selectedProject={selectedProject} setSelectedProject={setSelectedProject} />
                :
                <div className="h-full bg-gradient-to-br from-background to-muted/60 py-12 px-4">
                    <div>
                        <div className="flex justify-between items-center">
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
                    </div>
                    {error ? <ErrorAlert message="Oops! We couldn't load Projects. Please try again in a moment." /> :
                        projects &&
                        <div className="flex flex-col mt-1 items-center h-full w-full">
                            <div className="flex flex-col items-center mb-8 sm:mb-12">
                                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-primary mb-4 sm:mb-6 drop-shadow-sm">
                                    Project Workspace
                                </h1>
                                <p className="text-base md:text-lg text-muted-foreground text-center max-w-[95vw] sm:max-w-xl">
                                    Manage all your video projects in one place.<br />
                                    Select a project to continue editing, or start a new one.
                                </p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5 md:gap-8 w-3/4 md:w-full max-h-[60vh] md:max-h-[56vh] overflow-y-auto justify-items-center px-2 sm:px-8 lg:px-18 pt-2 sm:pt-4">
                                {projects.map(project => (
                                    <div
                                        key={project.id}
                                        className="group w-full sm:w-80 h-36 sm:h-42 bg-card border border-border rounded-2xl shadow-md hover:shadow-xl transition-shadow duration-200 cursor-pointer flex flex-col justify-center items-center p-4 sm:p-6 relative min-w-0"
                                    >
                                        <ConfirmationDialog
                                            trigger={
                                                <button
                                                    className="absolute top-[-0.5rem] right-[-0.5rem] z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-muted-foreground hover:scale-120 hover:transition-transform hover:cursor-pointer rounded-full bg-background shadow"
                                                    title="Remove project"
                                                >
                                                    <IconCircleMinus />
                                                </button>
                                            }
                                            title="Delete Project"
                                            description="Are you sure you want to permanently delete this project? This action cannot be undone."
                                            confirmText="Delete"
                                            cancelText="Cancel"
                                            onConfirm={() => {
                                                toast.promise(
                                                    deleteProject(project.id),
                                                    {
                                                        loading: "Deleting project...",
                                                        success: "Project deleted successfully!",
                                                        error: "Failed to delete project.",
                                                    }
                                                )
                                            }}
                                        />
                                        <div
                                            onClick={() => setSelectedProject(project.id)}
                                            className="overflow-hidden w-full h-full flex flex-col justify-center items-center"
                                        >
                                            <div className="w-12 sm:w-16 h-12 sm:h-16 rounded-full bg-primary/10 flex items-center justify-center mb-3 sm:mb-4">
                                                <span className="text-xl sm:text-2xl font-bold overflow-ellipsis text-primary group-hover:scale-110 transition-transform duration-200">
                                                    {project.name.charAt(0).toUpperCase()}
                                                </span>
                                            </div>
                                            <h3
                                                className="text-base sm:text-lg font-semibold text-center mb-0.5 sm:mb-1 truncate w-full"
                                                title={project.name}
                                            >
                                                {project.name}
                                            </h3>
                                        </div>
                                    </div>
                                ))}
                                <div className="group w-full sm:w-80 h-36 sm:h-42 bg-card border border-border rounded-2xl shadow-md hover:shadow-xl transition-shadow duration-200 flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden min-w-0">
                                    <div className="w-12 sm:w-16 h-12 sm:h-16 rounded-full bg-primary/10 flex items-center justify-center mb-3 sm:mb-4">
                                        <span className="text-xl sm:text-2xl font-bold text-primary group-hover:scale-110 transition-transform duration-200">
                                            <ProjectCreateDialog setProjects={setProjects} />
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    }
                </div>
            }
        </div>
    )
}