import { createContext, useContext, useState } from "react"
import type { ReactNode } from "react"

interface ActiveConversationContextType {
    activeConversation: string | undefined;
    setActiveConversation: (Conversation: string) => void;
}

const ActiveConversationContext = createContext<ActiveConversationContextType | undefined>(undefined);

export function ActiveConversationProvider({ children }: { children: ReactNode }) {
    const [activeConversation, setActiveConversation] = useState<string>();

    return (
        <ActiveConversationContext.Provider value={{ activeConversation, setActiveConversation }}>
            {children}
        </ActiveConversationContext.Provider>
    );
}

export const useActiveConversation = () => {
    const context = useContext(ActiveConversationContext);
    if (context === undefined) {
        throw new Error('useActiveConversation must be used within an ActiveConversationProvider');
    }
    return context;
}