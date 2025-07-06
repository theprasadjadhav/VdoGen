import { ClerkProvider, SignedIn } from '@clerk/clerk-react'
import Page from './app/dashboard/Page'
import { ThemeProvider, useTheme } from './components/theme-provider'
import { dark } from '@clerk/themes'
import { ActiveConversationProvider } from './hooks/use-active-conversation'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!PUBLISHABLE_KEY) {
  throw new Error('Add your Clerk Publishable Key to the .env file')
}

function AppContent() {
  const { theme } = useTheme()

  return (
    <ClerkProvider
      appearance={{
        baseTheme: theme === "dark" ? dark : undefined,
      }}
      publishableKey={PUBLISHABLE_KEY} 
      afterSignOutUrl="http://localhost:8081/"
    >
      <SignedIn>
        <ActiveConversationProvider>
          <Page />
        </ActiveConversationProvider>
      </SignedIn>
    </ClerkProvider>
  )
}

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <AppContent />
    </ThemeProvider>
  )
}

export default App
