import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
} from "@/components/ui/form"
import { Textarea } from "@/components/ui/textarea"
import { IconArrowUp, IconSettings } from "@tabler/icons-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useState } from "react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu"

const videoSpecsSchema = z.object({
    resolution: z.enum(["1080p", "720p", "480p", "360p", ""]),
    fps: z.enum(["24", "30", "60", ""]),
    duration: z.enum(["5", "10", "15", "30", "60", "120", ""]),
    aspectRatio: z.enum(["16:9", "9:16", "4:3", ""])
})

export const FormSchema = z.object({
    prompt: z.string(),
    specs: videoSpecsSchema
})

type SearchAreaType = {
    className: string,
    onSubmit: (data: z.infer<typeof FormSchema>) => Promise<void>,
    disabled: boolean,
}

export function SearchArea({ className, onSubmit, disabled }: SearchAreaType) {

    const [loading, setLoading] = useState(false);

    const form = useForm<z.infer<typeof FormSchema>>({
        resolver: zodResolver(FormSchema),
    })

    return (
        <div className={className}>
            <Form {...form} >
                <form
                    onSubmit={
                        form.handleSubmit(async (data) => {
                            setLoading(true)
                            await onSubmit(data);
                            setLoading(false)
                            form.reset({
                                prompt: "",
                                specs: {
                                    resolution: "",
                                    aspectRatio: "",
                                    fps: "",
                                    duration: ""
                                }
                            })
                        }
                        )}
                    className="w-2/3 space-y-6"
                >

                    {/* search area container */}
                    <div className="flex flex-col gap-2 border-1 p-2 rounded-xl ">

                        {/* text area */}
                        <FormField
                            control={form.control}
                            name="prompt"
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Describe the video you want to create..."
                                            className="resize-none p-2 pr-10 break-words shadow-none"
                                            disabled={disabled}
                                            {...field}
                                        />
                                    </FormControl>

                                </FormItem>
                            )}
                        />
                        {/* specs and submit button container */}
                        <div className="flex p-1">

                            <div className="lg:hidden">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline"><IconSettings /></Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" className="lg:hidden">
                                        <DropdownMenuGroup>
                                            <DropdownMenuItem>
                                                <FormField
                                                    control={form.control}
                                                    name="specs.resolution"
                                                    render={({ field }) => (
                                                        <FormItem  >
                                                            <Select onValueChange={field.onChange} value={field.value} disabled={disabled}>
                                                                <FormControl >
                                                                    <SelectTrigger >
                                                                        <SelectValue placeholder="Resolution" />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    <SelectItem value="1080p">1080p</SelectItem>
                                                                    <SelectItem value="720p">720p</SelectItem>
                                                                    <SelectItem value="480p">480p</SelectItem>
                                                                    <SelectItem value="360p">360p</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </FormItem>
                                                    )}
                                                />
                                            </DropdownMenuItem>
                                            <DropdownMenuItem>
                                                <FormField
                                                    control={form.control}
                                                    name="specs.fps"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <Select onValueChange={field.onChange} value={field.value} disabled={disabled}>
                                                                <FormControl>
                                                                    <SelectTrigger>
                                                                        <SelectValue placeholder="FPS" />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    <SelectItem value="24">24 FPS</SelectItem>
                                                                    <SelectItem value="30">30 FPS</SelectItem>
                                                                    <SelectItem value="60">60 FPS</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </FormItem>
                                                    )}
                                                />
                                            </DropdownMenuItem>
                                            <DropdownMenuItem>
                                                <FormField
                                                    control={form.control}
                                                    name="specs.duration"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <Select onValueChange={field.onChange} value={field.value} disabled={disabled}>
                                                                <FormControl>
                                                                    <SelectTrigger>
                                                                        <SelectValue placeholder="Duration" />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    <SelectItem value="5">5 seconds</SelectItem>
                                                                    <SelectItem value="10">10 seconds</SelectItem>
                                                                    <SelectItem value="15">15 seconds</SelectItem>
                                                                    <SelectItem value="30">30 seconds</SelectItem>
                                                                    <SelectItem value="60">1 minute</SelectItem>
                                                                    <SelectItem value="120">2 minutes</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </FormItem>
                                                    )}
                                                />
                                            </DropdownMenuItem>
                                            <DropdownMenuItem>
                                                <FormField
                                                    control={form.control}
                                                    name="specs.aspectRatio"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <Select onValueChange={field.onChange} value={field.value} disabled={disabled}>
                                                                <FormControl>
                                                                    <SelectTrigger>
                                                                        <SelectValue placeholder="Aspect Ratio" />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    <SelectItem value="16:9">16:9</SelectItem>
                                                                    <SelectItem value="9:16">9:16</SelectItem>
                                                                    <SelectItem value="4:3">4:3</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </FormItem>
                                                    )}
                                                />
                                            </DropdownMenuItem>
                                        </DropdownMenuGroup>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            <div className="hidden lg:flex gap-2 overflow-auto mr-2 ">
                                {/* resolution select */}
                                <FormField
                                    control={form.control}
                                    name="specs.resolution"
                                    render={({ field }) => (
                                        <FormItem >
                                            <Select onValueChange={field.onChange} value={field.value} disabled={disabled}>
                                                <FormControl>
                                                    <SelectTrigger >
                                                        <SelectValue placeholder="Resolution" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="1080p">1080p</SelectItem>
                                                    <SelectItem value="720p">720p</SelectItem>
                                                    <SelectItem value="480p">480p</SelectItem>
                                                    <SelectItem value="360p">360p</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}
                                />

                                {/* FPS select */}
                                <FormField
                                    control={form.control}
                                    name="specs.fps"
                                    render={({ field }) => (
                                        <FormItem>
                                            <Select onValueChange={field.onChange} value={field.value} disabled={disabled}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="FPS" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="24">24 FPS</SelectItem>
                                                    <SelectItem value="30">30 FPS</SelectItem>
                                                    <SelectItem value="60">60 FPS</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}
                                />

                                {/* duration select */}
                                <FormField
                                    control={form.control}
                                    name="specs.duration"
                                    render={({ field }) => (
                                        <FormItem>
                                            <Select onValueChange={field.onChange} value={field.value} disabled={disabled}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Duration" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="5">5 seconds</SelectItem>
                                                    <SelectItem value="10">10 seconds</SelectItem>
                                                    <SelectItem value="15">15 seconds</SelectItem>
                                                    <SelectItem value="30">30 seconds</SelectItem>
                                                    <SelectItem value="60">1 minute</SelectItem>
                                                    <SelectItem value="120">2 minutes</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}
                                />

                                {/* aspect raio select */}
                                <FormField
                                    control={form.control}
                                    name="specs.aspectRatio"
                                    render={({ field }) => (
                                        <FormItem>
                                            <Select onValueChange={field.onChange} value={field.value} disabled={disabled}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Aspect Ratio" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="16:9">16:9</SelectItem>
                                                    <SelectItem value="9:16">9:16</SelectItem>
                                                    <SelectItem value="4:3">4:3</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}
                                />

                            </div>

                            {/* submit button */}
                            {
                                <Button
                                    type="submit"
                                    className="ml-auto cursor-pointer"
                                    disabled={!form.watch("prompt") || loading || disabled}
                                >

                                    {loading ?
                                        <span className="flex items-center gap-2">
                                            <span className="inline-block w-4 h-4 border-2 border-t-transparent border-gray-400 rounded-full animate-spin"></span>
                                        </span>
                                        :
                                        <IconArrowUp />
                                    }

                                </Button>

                            }
                        </div>

                    </div>
                </form>
            </Form>
        </div>
    )
}
