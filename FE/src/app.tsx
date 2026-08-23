import { ThemeProvider } from './hooks/use-theme'
import { ActiveConversationProvider } from './hooks/use-active-conversation'
import { BrowserRouter, Routes, Route, Navigate } from "react-router"
import { Project } from "./app/dashboard/project-page"
import { Toaster } from "sonner"
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider, useAuth } from './hooks/use-Auth';
import Chat from './app/dashboard/chat-page'
import Auth from './app/dashboard/auth-page'
import { useEffect } from 'react'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

function LandingRedirect() {
  // Prod: '/' is the static landing page served by the Cloudflare worker.
  // Dev: vite serves this SPA at '/', so redirecting there would loop forever.
  const dev = import.meta.env.DEV
  useEffect(() => {
    if (!dev) window.location.replace('/')
  }, [dev])
  return dev ? <Navigate replace to="/log-in" /> : null
}

function AppContentNew() {

  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center w-full h-screen">
        <span className="shadcn-spinner h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></span>
      </div>
    )
  }

  return (
    <>
      <BrowserRouter>
        {user ?
          <ActiveConversationProvider>
            <Routes>
              <Route path="/chat" element={<Chat />} />
              <Route path='/editor' element={<Project />} />
              <Route path="*" element={<Navigate replace to="/chat" />} />
            </Routes>
          </ActiveConversationProvider>
          :
          <Routes>
            <Route path="/log-in" element={<Auth mode='login' />} />
            <Route path="/sign-up" element={<Auth mode='signup' />} />
            <Route path="*" element={<LandingRedirect />} />
          </Routes>
        }
      </BrowserRouter>


    </>
  )
}

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <Toaster richColors position="top-center" />
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <AuthProvider>
          <AppContentNew />
        </AuthProvider>
      </GoogleOAuthProvider>
    </ThemeProvider>
  )
}

export default App
