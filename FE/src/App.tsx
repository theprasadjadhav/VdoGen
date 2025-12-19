import { ClerkProvider, SignedIn, SignedOut, SignIn, SignUp } from '@clerk/clerk-react'
import Page from "./app/dashboard/page"
import { ThemeProvider, useTheme } from './components/theme-provider'
import { dark } from '@clerk/themes'
import { ActiveConversationProvider } from './hooks/use-active-conversation'
import { BrowserRouter, Routes, Route, Navigate } from "react-router"
import { Project } from "./app/dashboard/project"
import { Toaster } from "sonner"
import { Pricing } from './app/dashboard/pricing'
import Home from './app/dashboard/home'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
const FRONTEND_URL = import.meta.env.VITE_FRONTEND_URL

if (!PUBLISHABLE_KEY) {
  throw new Error('Add your Clerk Publishable Key to the .env file')
}

if (!FRONTEND_URL) {
  throw new Error('Add your VITE_FRONTEND_URL to the .env file')
}

function AppContent() {
  const { theme } = useTheme()

  return (
    <ClerkProvider
      appearance={{
        baseTheme: theme === "dark" ? dark : undefined,
      }}
      publishableKey={PUBLISHABLE_KEY}
      allowedRedirectOrigins={[FRONTEND_URL]}
      signInUrl={`${FRONTEND_URL}/sign-in`}
      signUpUrl={`${FRONTEND_URL}/sign-up`}
      signInFallbackRedirectUrl={`${FRONTEND_URL}/chat`}
      signUpFallbackRedirectUrl={`${FRONTEND_URL}/chat`}
      afterSignOutUrl={FRONTEND_URL}
    >
      <SignedOut>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home/>} />
            <Route path="/sign-in" element={<SignIn />} />
            <Route path="/sign-up" element={<SignUp />} />
            <Route path="*" element={<Navigate replace to="/" />} />
          </Routes>
        </BrowserRouter>
      </SignedOut>
      <SignedIn>
        <ActiveConversationProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/chat" element={<Page />} />
                <Route path='/editor' element={<Project/>}/>
                <Route path='/pricing' element={<Pricing/>}/>
                <Route path="/sign-in" element={<Navigate replace to="/chat" />} />
                <Route path="/sign-up" element={<Navigate replace to="/chat" />} />
                <Route path="*" element={<Navigate replace to="/" />} />
              </Routes>
            </BrowserRouter>
        </ActiveConversationProvider>
      </SignedIn>
    </ClerkProvider>
  )
}

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <Toaster richColors position="top-center" />
      <AppContent />
    </ThemeProvider>
  )
}

export default App
