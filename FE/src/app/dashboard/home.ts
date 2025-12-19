import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import {
  IconVideo,
  IconSparkles,
  IconRocket,
  IconPlayerPlay,
  IconBrain,
  IconEdit,
  IconDownload,
  IconUsers,
  IconClock,
  IconBrandTwitter,
  IconBrandGithub,
  IconBrandYoutube,
  IconMessageCircle,
  IconBolt,
  IconSchool,
  IconAdjustments,
  IconLogout,
} from '@tabler/icons-react';
import { Link } from 'react-router';
import {
  Button,
} from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Badge,
} from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const Home: React.FC = () => {
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoInfoRef = useRef<HTMLDivElement>(null);
  const { isSignedIn, signOut } = useAuth();

  useEffect(() => {
    const handleSmoothScroll = (e: Event) => {
      const target = e.target as HTMLAnchorElement;
      if (target.getAttribute('href')?.startsWith('#')) {
        e.preventDefault();
        const targetElement = document.querySelector(target.getAttribute('href')!);
        if (targetElement) {
          targetElement.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
        }
      }
    };

    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener('click', handleSmoothScroll);
    });

    // Intersection Observer for animations
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px',
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          (entry.target as HTMLElement).style.animationPlayState = 'running';
        }
      });
    }, observerOptions);

    document.querySelectorAll('.fade-in, .stagger-animation').forEach((el) => {
      observer.observe(el);
    });

    return () => {
      document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
        anchor.removeEventListener('click', handleSmoothScroll);
      });
    };
  }, []);

  const playVideo = async (videoId: string) => {
    const video = videoRef.current;
    if (!video) return;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Hls = (window as any).Hls;
      if (Hls && Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(`${import.meta.env.VITE_BACKEND_URL}/video/${videoId}/manifest?token="test"`);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, function () {
          video.play();
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = `${import.meta.env.VITE_BACKEND_URL}/video/${videoId}/manifest?token="test"`;
        video.addEventListener('loadedmetadata', () => video.play());
      }
    } catch (error) {
      console.error('Error playing video:', error);
    }
  };

  const playDemo = async () => {
    const video = videoRef.current;
    const videoInfo = videoInfoRef.current;

    if (!video || !videoInfo) return;

    try {
      await playVideo('105');
      setIsVideoPlaying(true);
      video.style.display = 'block';
      videoInfo.style.display = 'none';

      video.addEventListener('ended', () => {
        setIsVideoPlaying(false);
        video.style.display = 'none';
        videoInfo.style.display = 'block';
      });
    } catch (error) {
      console.error('Error playing demo:', error);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-3/4 right-1/4 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute bottom-1/4 left-1/3 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl animate-pulse delay-2000" />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border py-6">
        <div className="max-w-6xl mx-auto px-6 flex justify-between items-center">
          <a href="#" className="flex items-center gap-2 text-xl font-semibold">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-md flex items-center justify-center">
              <IconVideo className=" text-white" />
            </div>
            <span className="inline text-base">VdoGen</span>
          </a>

          <div className="hidden md:flex gap-8">
            <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium">
              Features
            </a>
            <a href="#how-it-works" className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium">
              How It Works
            </a>
            <a href="#examples" className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium">
              Examples
            </a>
            <a href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium">
              Pricing
            </a>
          </div>

          {isSignedIn ? (
            <div className="flex gap-2.5">
              <Button
                asChild
                className="px-3 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg text-white hover:shadow-lg hover:shadow-indigo-500/25 hover:-translate-y-0.5 transition-all text-sm font-medium"
              >
                <Link to="/chat">
                  Dashboard
                </Link>
              </Button>
              <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      onClick={() => signOut()}
                      className="px-2 py-2 border border-border hover:-translate-y-0.5 rounded-lg text-white hover:bg-accent transition-all text-sm font-medium"
                    >
                      <IconLogout className="w-2 h-2" />
                    </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="center">
                  Sign out
                </TooltipContent>
              </Tooltip>

            </div>
          ) : (
            <div className="flex gap-2.5">
              <Button
                asChild
                variant="outline"
                className="px-3 py-2.5 border border-border rounded-lg text-white hover:bg-accent hover:-translate-y-0.5 transition-all text-sm font-medium"
              >
                <a href={`https://wanted-fish-0.accounts.dev/sign-in?redirect_url=${import.meta.env.VITE_FRONTEND_URL}/chat`}>
                  Sign In
                </a>
              </Button>
              <Button
                asChild
                className="px-3 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg text-white hover:shadow-lg hover:shadow-indigo-500/25 hover:-translate-y-0.5 transition-all text-sm font-medium"
              >
                <a href={`https://wanted-fish-0.accounts.dev/sign-in?redirect_url=${import.meta.env.VITE_FRONTEND_URL}/chat`}>
                  Sign Up
                </a>
              </Button>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-16 text-center relative z-10">
        <div className="max-w-6xl mx-auto px-6">
          <Badge
            variant="secondary"
            className="inline-flex items-center gap-2 bg-indigo-500/10 px-4 py-2 rounded-full text-sm text-indigo-400 mb-8"
          >
            <IconSparkles className="w-4 h-4" />
            <span>Powered by AI & Advanced Algorithms</span>
          </Badge>

          <h1 className="text-5xl md:text-6xl font-extrabold leading-tight mb-8 tracking-tight">
            Transform{' '}
            <span className="bg-gradient-to-r from-indigo-500 via-purple-600 to-emerald-500 bg-clip-text text-transparent">
              Ideas
            </span>{' '}
            into
            <br />
            Educational{' '}
            <span className="bg-gradient-to-r from-indigo-500 via-purple-600 to-emerald-500 bg-clip-text text-transparent">
              Videos
            </span>
          </h1>

          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-12">
            Generate stunning mathematical and educational animations instantly.
            Just describe what you want, and our AI creates professional videos with built-in editing features.
          </p>

          {!isSignedIn &&

            <div className="flex flex-col sm:flex-row gap-6 justify-center mb-16">
              <Button
                asChild
                className="px-5 py-6 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg text-white hover:shadow-lg hover:shadow-indigo-500/25 hover:-translate-y-0.5 transition-all text-base font-medium flex items-center justify-center gap-2"
              >
                <a href={`https://wanted-fish-0.accounts.dev/sign-in?redirect_url=${import.meta.env.VITE_FRONTEND_URL}/chat`}>
                  <IconRocket className="w-4 h-4" />
                  Try Free Demo
                </a>
              </Button>
              <Button
                asChild
                variant="outline"
                className=" px-5 py-6 border border-border rounded-lg text-white hover:bg-accent transition-all text-base font-medium flex items-center justify-center gap-2"
              >
                <a href="#">
                  <IconPlayerPlay className="w-4 h-4" />
                  Watch Examples
                </a>
              </Button>
            </div>
          }

          {/* Demo Video */}
          <Card className="max-w-4xl mx-auto bg-card rounded-xl overflow-hidden border border-border relative">
            <div
              className="relative aspect-video bg-gradient-to-br from-indigo-500/10 to-purple-600/10 flex items-center justify-center cursor-pointer"
              onClick={playDemo}
            >
              <video
                ref={videoRef}
                controls
                className="w-full h-full object-cover hidden"
                style={{ display: isVideoPlaying ? 'block' : 'none' }}
              >
                <source src="#" type="video/mp4" />
                Your browser does not support the video tag.
              </video>

              {!isVideoPlaying && (
                <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/15 hover:scale-105 transition-all">
                  <IconPlayerPlay className="w-5 h-5 ml-1" />
                </div>
              )}
            </div>

            <div
              ref={videoInfoRef}
              className="absolute top-4 left-4 bg-black/60 px-4 py-2 rounded-lg text-sm text-muted-foreground flex items-center gap-2"
            >
              <IconClock className="w-4 h-4" />
              Generated in 12 seconds
            </div>
          </Card>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 tracking-tight">Why Choose VdoGen?</h2>
            <p className="text-lg text-muted-foreground">
              The most advanced AI-powered mathematical animation platform
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="bg-card/90 hover:bg-card transition-all border border-border">
              <CardHeader>
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center mb-6">
                  <IconBrain className="w-6 h-6 text-white" />
                </div>
                <CardTitle>AI-Powered Intelligence</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  Advanced language models understand complex mathematical concepts and generate precise animations automatically.
                </p>
              </CardContent>
            </Card>
            <Card className="bg-card/90 hover:bg-card transition-all border border-border">
              <CardHeader>
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center mb-6">
                  <IconBolt className="w-6 h-6 text-white" />
                </div>
                <CardTitle>Lightning Fast</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  Generate professional-quality animations in seconds, not hours. Perfect for busy educators and content creators.
                </p>
              </CardContent>
            </Card>
            <Card className="bg-card/90 hover:bg-card transition-all border border-border">
              <CardHeader>
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center mb-6">
                  <IconEdit className="w-6 h-6 text-white" />
                </div>
                <CardTitle>Built-in Video Editor</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  Edit your generated videos with our intuitive editor. Adjust timing, colors, text, and effects without any coding.
                </p>
              </CardContent>
            </Card>
            <Card className="bg-card/90 hover:bg-card transition-all border border-border">
              <CardHeader>
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center mb-6">
                  <IconSchool className="w-6 h-6 text-white" />
                </div>
                <CardTitle>Education Ready</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  Designed specifically for teachers, students, and educational content creators. Perfect for lessons and presentations.
                </p>
              </CardContent>
            </Card>
            <Card className="bg-card/90 hover:bg-card transition-all border border-border">
              <CardHeader>
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center mb-6">
                  <IconDownload className="w-6 h-6 text-white" />
                </div>
                <CardTitle>High Quality Export</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  Download videos in multiple formats and resolutions. Ready for YouTube, presentations, or classroom use.
                </p>
              </CardContent>
            </Card>
            <Card className="bg-card/90 hover:bg-card transition-all border border-border">
              <CardHeader>
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center mb-6">
                  <IconAdjustments className="w-6 h-6 text-white" />
                </div>
                <CardTitle>Advanced Customization</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  Fine-tune every aspect of your video with our advanced editing tools. Control animations, transitions, and visual effects.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 tracking-tight">How It Works</h2>
            <p className="text-lg text-muted-foreground">
              Three simple steps to create professional animations
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="text-center bg-card/90 border border-border">
              <CardHeader>
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6 font-semibold text-white">
                  1
                </div>
                <CardTitle>Describe Your Vision</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  Tell us what mathematical concept or educational topic you want to visualize. Use natural language - no coding required.
                </p>
              </CardContent>
            </Card>
            <Card className="text-center bg-card/90 border border-border">
              <CardHeader>
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6 font-semibold text-white">
                  2
                </div>
                <CardTitle>AI Generates Code</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  Our advanced AI converts your description into clean, optimized code that creates your animation.
                </p>
              </CardContent>
            </Card>
            <Card className="text-center bg-card/90 border border-border">
              <CardHeader>
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6 font-semibold text-white">
                  3
                </div>
                <CardTitle>Download & Use</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  Watch your animation render in real-time, then download the video and source code for immediate use.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 ">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 tracking-tight">Start Creating Today</h2>
            <p className="text-lg text-muted-foreground">
              Join thousands of educators and creators using AI to create and edit educational videos
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="bg-card/90 border border-border text-center">
              <CardHeader>
                <IconUsers className="w-8 h-8 text-indigo-500 mx-auto mb-4" />
                <CardTitle className="text-2xl font-bold mb-2">10K+</CardTitle>
                <CardDescription className="text-muted-foreground text-sm">
                  Active Users
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="bg-card/90 border border-border text-center">
              <CardHeader>
                <IconVideo className="w-8 h-8 text-purple-500 mx-auto mb-4" />
                <CardTitle className="text-2xl font-bold mb-2">50K+</CardTitle>
                <CardDescription className="text-muted-foreground text-sm">
                  Videos Created
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="bg-card/90 border border-border text-center">
              <CardHeader>
                <IconClock className="w-8 h-8 text-emerald-500 mx-auto mb-4" />
                <CardTitle className="text-2xl font-bold mb-2">12s</CardTitle>
                <CardDescription className="text-muted-foreground text-sm">
                  Average Generation Time
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 border-t border-border">
        <div className="max-w-6xl mx-auto px-2">

          <div className="flex flex-col md:flex-row justify-between items-center mb-8">
            <a href="#" className="flex items-center gap-2 text-xl font-semibold mb-8 md:mb-0">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-md flex items-center justify-center">
                <IconVideo className="w-4 h-4 text-white" />
              </div>
              <span>VdoGen</span>
            </a>

            <div className="flex flex-wrap gap-8 justify-center mb-8 md:mb-0">
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
                Privacy Policy
              </a>
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
                Terms of Service
              </a>
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
                Documentation
              </a>
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
                Support
              </a>
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
                Blog
              </a>
            </div>

            <div className="flex gap-4">
              <Button asChild variant="ghost" size="icon" className="w-10 h-10 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-all">
                <a href="#">
                  <IconBrandTwitter className="w-4 h-4" />
                </a>
              </Button>
              <Button asChild variant="ghost" size="icon" className="w-10 h-10 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-all">
                <a href="#">
                  <IconBrandGithub className="w-4 h-4" />
                </a>
              </Button>
              <Button asChild variant="ghost" size="icon" className="w-10 h-10 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-all">
                <a href="#">
                  <IconBrandYoutube className="w-4 h-4" />
                </a>
              </Button>
              <Button asChild variant="ghost" size="icon" className="w-10 h-10 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-all">
                <a href="#">
                  <IconMessageCircle className="w-4 h-4" />
                </a>
              </Button>
            </div>
          </div>

          <p className="text-center text-muted-foreground text-sm">
            © 2025 VdoGen. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Home;
