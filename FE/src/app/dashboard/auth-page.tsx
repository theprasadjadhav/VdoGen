import { LoginForm } from "@/components/login-form";
import { SignupForm } from "@/components/signup-form";
import { GoogleLogin, type CredentialResponse } from "@react-oauth/google";
import { baseAxios } from "@/lib/axios";
import { useAuth } from "@/hooks/use-Auth";
import { toast } from "sonner";
import { useNavigate } from "react-router";

type AuthMode = "login" | "signup";
type AuthProps = { mode?: AuthMode };

export default function Auth({ mode = "login" }: AuthProps) {
    const { setUser, setLoading } = useAuth();
    const navigator = useNavigate();

    async function handleGoogleAuth(credentialResponse: CredentialResponse) {
        try {
            setLoading(true);
            const res = await baseAxios.post("/auth/google", { token: credentialResponse.credential });
            if (res.status === 200 && res.data?.success) {
                setUser(res.data.user);
                navigator("/chat");
            } else {
                throw Error("Failed to sign in with Google. Please try again.");
            }
        } catch (error) {
            if (error instanceof Error) toast.error(error.message);
            else toast.error("An unexpected error occurred while signing in with Google.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={{
            background: '#06060b',
            minHeight: '100vh',
            color: '#e4e4f0',
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            WebkitFontSmoothing: 'antialiased',
        }}>

            {/* Atmospheric glows */}
            <div aria-hidden="true" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0 }}>
                <div style={{
                    position: 'absolute', borderRadius: '50%',
                    width: '700px', height: '700px', top: '-150px', left: '-150px',
                    background: 'radial-gradient(circle, rgba(99,102,241,0.07) 0%, transparent 65%)',
                }} />
                <div style={{
                    position: 'absolute', borderRadius: '50%',
                    width: '600px', height: '600px', top: '10%', right: '-120px',
                    background: 'radial-gradient(circle, rgba(168,85,247,0.06) 0%, transparent 65%)',
                }} />
            </div>

            {/* Centered layout */}
            <div style={{
                position: 'relative', zIndex: 10,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                minHeight: '100vh', padding: '24px',
            }}>

                {/* Card */}
                <div style={{
                    width: '100%', maxWidth: '420px',
                    background: '#0d0d18',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '14px',
                    padding: '32px',
                    boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
                }}>

                    {/* Logo row */}
                    <a href="/" style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        marginBottom: '28px', textDecoration: 'none', color: '#e4e4f0',
                    }}>
                        <div style={{
                            width: '28px', height: '28px', borderRadius: '7px',
                            background: 'linear-gradient(135deg, #6366f1, #a78bfa)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"
                                strokeLinecap="round" strokeLinejoin="round"
                                aria-hidden="true" style={{ width: '13px', height: '13px' }}>
                                <path d="M15 10l4.553-2.069A1 1 0 0 1 21 8.82v6.361a1 1 0 0 1-1.447.894L15 14" />
                                <rect x="2" y="6" width="13" height="12" rx="2" ry="2" />
                            </svg>
                        </div>
                        <span style={{ fontSize: '15px', fontWeight: 600, letterSpacing: '-0.01em' }}>VdoGen</span>
                    </a>

                    {/* Title */}
                    <div style={{ marginBottom: '24px' }}>
                        <h1 style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '5px', color: '#e4e4f0' }}>
                            {mode === 'login' ? 'Welcome back' : 'Create account'}
                        </h1>
                        <p style={{ fontSize: '14px', color: '#64648a', lineHeight: 1.55 }}>
                            {mode === 'login'
                                ? 'Access your projects and keep shipping videos.'
                                : 'Spin up an account to start animating.'}
                        </p>
                    </div>

                    {/* Google — dark theme, full width */}
                    <div style={{ marginBottom: '20px' }}>
                        <GoogleLogin
                            onSuccess={handleGoogleAuth}
                            onError={() => toast.error("Failed to sign in with Google. Please try again.")}
                            useOneTap
                            theme="filled_black"
                            size="large"
                            width="356"
                            text={mode === 'login' ? 'signin_with' : 'signup_with'}
                        />
                    </div>

                    {/* Divider */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.07)' }} />
                        <span style={{ fontSize: '13px', color: '#64648a' }}>or</span>
                        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.07)' }} />
                    </div>

                    {/* Form */}
                    {mode === 'login' ? (
                        <LoginForm onSwitchToSignup={() => navigator('/sign-up')} />
                    ) : (
                        <SignupForm onSwitchToLogin={() => navigator('/log-in')} />
                    )}
                </div>
            </div>
        </div>
    );
}
