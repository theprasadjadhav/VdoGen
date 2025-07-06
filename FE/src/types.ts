export type ContentType = {
    id: string;
    prompt: string;
    conversationId: string;
    isError: boolean;
    error?: string;
    status: string;
    userId: string;
    createdAt: Date;
}

export type HistoryType = {
    id:string,
    firstPrompt:string,
}