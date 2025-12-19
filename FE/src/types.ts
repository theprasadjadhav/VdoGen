export type ContentType = {
    id: string;
    prompt: string;
    conversationId: string;
    isError: boolean;
    error?: string;
    status: string;
    editorProject?:{
            id: string,
    }[],
    createdAt: Date;
}

export type HistoryType = {
    id: string,
    firstPrompt: string,
}

export type projectType = {
    id: string;
    name: string;
    videos?: { id: number; }[];
    data?: string;
}

export type Clip = {
    id: string;
    videoId: string;
    url?: string;
    label: string;
    startTime: number;
    endTime: number;
    timelineStartTime?: number;
    timelineEndTime?: number;

};