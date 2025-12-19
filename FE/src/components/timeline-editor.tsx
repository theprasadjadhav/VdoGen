import { useState, useRef, useEffect } from 'react';
import { Rnd } from 'react-rnd';
import { Slider } from "@/components/ui/slider"
import type { DraggableEvent, DraggableData } from 'react-draggable';
import type { Clip } from '@/types';
import { Button } from './ui/button';
import { IconCut, IconTrash } from '@tabler/icons-react';
import { v4 as uuid } from "uuid"
import { toast } from 'sonner';


type TimeLineProps = {
    isPlaying:boolean,
    handlePlayheadDrag: (time: number) => void,
    timelinecurrentTime: number,
    clips: Required<Clip>[],
    setCurrentClip: React.Dispatch<React.SetStateAction<Clip | null | undefined>>
    setClips: React.Dispatch<React.SetStateAction<Required<Clip>[]>>,
    getManifestFileAndCreateBlob: (videoId: string) => Promise<[string, null] | [null, string]>,
    setSaved: React.Dispatch<React.SetStateAction<boolean>>
}


export default function TimelineEditor(props: TimeLineProps) {

    const { isPlaying, timelinecurrentTime, clips, setClips, getManifestFileAndCreateBlob, setSaved, handlePlayheadDrag, setCurrentClip } = props

    const [scale, setScale] = useState(100); // px/sec
    const playheadRef = useRef<HTMLDivElement>(null);
    const [duration, setDuration] = useState(100); // total timeline duration in sec
    const timelineRef = useRef<HTMLDivElement>(null);
    const [selectedClip, setSelectedClip] = useState<string | null>(null) 
    const selectedClipRef = useRef(selectedClip)

    useEffect(()=>{
        selectedClipRef.current = selectedClip
    },[selectedClip])

    useEffect(()=>{
        function handleClickOutside(e:MouseEvent){
            const target = e.target as HTMLElement
            const clipId = target.getAttribute("clip-id")
            if(selectedClipRef.current != null && (!clipId || selectedClipRef.current != clipId)){
                setSelectedClip(null)
            }
        }
        document.addEventListener("click",(e)=>handleClickOutside(e))
        return () => {
            document.removeEventListener("click",handleClickOutside)
        }

    },[])

    useEffect(() => {
        if (playheadRef.current) {
            playheadRef.current.scrollIntoView({ behavior: "instant", inline: "center" })
        }
    }, [timelinecurrentTime, scale]);

    function updateClips(updatedClip: Required<Clip>, isNew: boolean) {
        setClips(prev => {
            let filtered = prev;
            if (!isNew) {
                filtered = prev.filter(c => c.id !== updatedClip.id)
            }
            const index = filtered.findIndex(c => c.timelineStartTime > updatedClip.timelineStartTime)
            const newClips = [...filtered]
            if (index === -1) {
                newClips.push(updatedClip)
            }
            else {
                newClips.splice(index, 0, updatedClip)
            }
            return newClips
        });
    }

    function updateDuration() {
        const lastClip = clips[clips.length - 1];
        const maxEnd = lastClip ? Math.floor(lastClip.timelineEndTime) : 0;
        setDuration(() => maxEnd > 90 ? maxEnd + 10 : 100)
    }

    const handleDragStop = (e: DraggableEvent, dragData: DraggableData, clip: Required<Clip>) => {
        e.preventDefault()
        const snapThreshold = 0.5; // seconds
        let newStart = dragData.x / scale
        let newEnd = newStart + (clip.timelineEndTime - clip.timelineStartTime)

        let leftNeighbor: Required<Clip> | null = null
        let rightNeighbor: Required<Clip> | null = null
        for (let i = 0; i < clips.length; i++) {
            const c = clips[i];
            if (c.id !== clip.id) {
                if (c.timelineEndTime <= newStart && (!leftNeighbor || c.timelineEndTime > leftNeighbor.timelineEndTime)) {
                    leftNeighbor = c
                }
                if (c.timelineStartTime >= newEnd && (!rightNeighbor || c.timelineStartTime < rightNeighbor.timelineStartTime)) {
                    rightNeighbor = c
                }
            }
        }

        if (leftNeighbor && Math.abs(newStart - leftNeighbor.timelineEndTime) <= snapThreshold) {
            newStart = leftNeighbor!.timelineEndTime
            newEnd = newStart + (clip.timelineEndTime - clip.timelineStartTime)
        }
        if (rightNeighbor && Math.abs(newEnd - rightNeighbor.timelineStartTime) <= snapThreshold) {
            newEnd = rightNeighbor!.timelineStartTime
            newStart = newEnd - (clip.timelineEndTime - clip.timelineStartTime)
        }
        const isOverlapping = clips.some(c => c.id !== clip.id && newStart < c.timelineEndTime && newEnd > c.timelineStartTime)
        if (!isOverlapping) {
            clip.timelineStartTime = newStart
            clip.timelineEndTime = newEnd
            setSaved(false)
            updateClips(clip, false)
            setCurrentClip(null)
            updateDuration()
        }
    }

    const handleCutClip = () => {

        const clip = clips.find(c => timelinecurrentTime > c.timelineStartTime && timelinecurrentTime < c.timelineEndTime)

        if(clip){
            const firstClip = {...clip}
            const secondClip = {...clip}

            firstClip.label = `${clip.label} 1`
            firstClip.endTime = clip.startTime + (timelinecurrentTime - clip.timelineStartTime)
            firstClip.timelineEndTime = timelinecurrentTime
            updateClips(firstClip,false)

            secondClip.id = uuid()
            secondClip.label = `${clip.label} 2`
            secondClip.startTime = clip.startTime + (timelinecurrentTime - clip.timelineStartTime)
            secondClip.timelineStartTime = timelinecurrentTime
            updateClips(secondClip,true)
        }

    }

    async function handleDrop(e: React.DragEvent<HTMLDivElement>) {
        e.preventDefault()

        const timelineRectangle = e.currentTarget.getBoundingClientRect();
        const dropX = e.clientX - timelineRectangle.left;
        const droingPoint = dropX / scale;

        const data = e.dataTransfer.getData("text/json")
        const clip: Required<Clip> = JSON.parse(data)

        const length = clip.endTime


        const [url, error] = await getManifestFileAndCreateBlob(clip.videoId)
        if (!url) {
            alert(error)
            return
        }

        clip.url = url

        let leftNeighbor: Required<Clip> | null = null;
        let rightNeighbor: Required<Clip> | null = null;
        let overlap = false
        for (let i = 0; i < clips.length; i++) {
            const c = clips[i];
            if (droingPoint > c.timelineStartTime && droingPoint < c.timelineEndTime) {
                overlap = true
                break;
            }
            if (c.timelineEndTime <= droingPoint && (!leftNeighbor || c.timelineEndTime > leftNeighbor.timelineEndTime)) {
                leftNeighbor = c;
            }
            if (c.timelineStartTime >= droingPoint && (!rightNeighbor || c.timelineStartTime < rightNeighbor.timelineStartTime)) {
                rightNeighbor = c;
            }
        }

        const spaceStart = leftNeighbor?.timelineEndTime || 0
        const spaceEnd = rightNeighbor?.timelineStartTime || Number.MAX_VALUE
        const availableSpace = spaceEnd - spaceStart

        if (availableSpace >= length && !overlap) {
            if (spaceStart > (droingPoint - (length / 2))) {
                clip.timelineStartTime = spaceStart
                clip.timelineEndTime = spaceStart + length
            } else if (spaceEnd < (droingPoint + (length / 2))) {
                clip.timelineEndTime = spaceEnd
                clip.timelineStartTime = spaceEnd - length
            } else {
                clip.timelineStartTime = droingPoint - (length / 2)
                clip.timelineEndTime = droingPoint + (length / 2)
            }
            let insertIndex: number
            if (!leftNeighbor) {
                insertIndex = 0
            } else if (!rightNeighbor) {
                insertIndex = clips.length
            } else {
                insertIndex = clips.findIndex(clip => clip.id = rightNeighbor.id)
            }
            setClips(prev => {
                const newClips = [...prev];
                newClips.splice(insertIndex, 0, clip);
                return newClips;
            });
            setSaved(false)
        } else {
            toast.warning(overlap ? "Overlap with existing clip." : "Not enough space at this position.");
        }
    }

    
    return (
        <div className="flex flex-col flex-1 w-full px-2 mt-auto">

            {/* delete, cut and timeline scroll */}
            <div className='flex mb-4'>
                {/* Delete button */}
                <Button
                    variant={"ghost"}
                    onClick={() => { 
                        setClips((clips) => clips.filter((c)=> c.id !== selectedClip))
                        setCurrentClip(null)
                    }}
                    disabled = { selectedClip ? false : true }
                >
                    <IconTrash />
                </Button>

                {/* cut button */}
                <Button
                    variant={"ghost"}
                    onClick={ handleCutClip }
                >
                    <IconCut />
                </Button>

                {/* Scale slider */}
                <div className="ml-auto flex items-center gap-2">
                    <label className="hidden sm:block text-xs font-medium">Zoom (px/s):</label>
                    <Slider
                        min={20}
                        max={300}
                        step={1}
                        value={[scale]}
                        onValueChange={([val]) => setScale(val)}
                        className="w-24"
                    />
                </div>

            </div>

            {/* Timeline container with scroll */}
            <div className="overflow-x-auto border rounded bg-gray-100 dark:bg-neutral-900" >

                <div
                    ref={timelineRef}
                    className="relative h-[100px] w-full"
                >
                    {/* Time Ruler */}
                    {[...Array(duration)].map((_, i) => (
                        <div
                            key={i}
                            className="absolute top-0 text-[10px] text-black dark:text-gray-300 border-r dark:border-gray-400 border-gray-500"
                            style={{ left: `${i * scale}px`, width: `${scale}px` }}
                        >
                            <div className="text-center">{i}s</div>
                        </div>
                    ))}

                    {/* Track row */}
                    <div
                        className="absolute top-[20px] left-0 right-0 h-[60px] bg-white dark:bg-neutral-600 border-y dark:border-gray-400 border-gray-300"
                        style={{ width: `${scale * duration}px` }}
                        onDrop={(e) => handleDrop(e)}
                        onDragOver={(e) => e.preventDefault()}
                    >
                        {clips.map(clip => (
                            <Rnd
                                key={clip.id}
                                bounds="parent"
                                size={{
                                    width: (clip.timelineEndTime - clip.timelineStartTime) * scale,
                                    height: 40,
                                }}
                                disableDragging={isPlaying}
                                position={{ x: clip.timelineStartTime * scale, y: 10 }}
                                onDragStop={(e, dragData) => handleDragStop(e, dragData, clip)}
                                enableResizing={false}
                                className="bg-blue-400 text-black dark:text-white text-xs font-medium rounded shadow-md"
                            >
                                <div
                                    key={clip.id}
                                    clip-id={clip.id}
                                    className={`w-full h-full flex items-center justify-center px-2 truncate ${selectedClip === clip.id ? "border-2 rounded border-orange-500" : ""}`}
                                    onClick={()=> !isPlaying && setSelectedClip(clip.id)}
                                >
                                    <input
                                        placeholder='Enter Name'
                                        className='text-center overflow-ellipsis'
                                        type="text"
                                        value={clip.label}
                                        onChange={e => { setClips(prevClips => prevClips.map(c => c.id === clip.id ? { ...c, label: e.target.value } : c)) }}
                                    />
                                </div>
                            </Rnd>
                        ))}

                        {/* Playhead */}
                        <Rnd
                            bounds="parent"
                            size={{
                                width: 20,
                                height: "100%",
                            }}
                            position={{ x: timelinecurrentTime * scale, y: 0 }}
                            enableResizing={false}
                            disableDragging = { isPlaying }
                            onDragStop={(e, d) => {
                                e.preventDefault()
                                handlePlayheadDrag(d.x / scale)
                            }}
                            style={{ zIndex: 100 }}
                        >
                            <div
                                ref={playheadRef}
                                className={`absolute top-0 w-[4px] h-full bg-red-500 z-50 cursor-grab`}
                            />
                        </Rnd>
                    </div>

                </div>

            </div>
        </div>
    );
};

