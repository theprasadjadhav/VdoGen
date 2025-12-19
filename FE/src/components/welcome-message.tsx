
export default function WelcomeMessage() {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center gap-3">
            <span className="text-3xl animate-bounce">🎥✨</span>
            <span className="text-xl font-semibold text-primary">Welcome to VdoGen with Manim!</span>
            <span className="text-base text-muted-foreground">
                Create stunning math and science animations using <span className="font-semibold">Manim</span>.<br />
                <span className="font-medium text-foreground">Type your idea or describe a scene below</span> and watch it come to life as a video.
            </span>
            <span className="text-sm text-muted-foreground">
                Try prompts like <span className="italic">"Show a circle transforming into a square"</span> or <span className="italic">"Animate the Pythagorean theorem proof"</span>.
            </span>
            <span className="text-xs text-muted-foreground">
                Powered by <a href="https://www.manim.community/" target="_blank" rel="noopener noreferrer" className="underline">Manim</a>
            </span>
        </div>
    )
}