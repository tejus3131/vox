import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-background px-4 gradient-mesh">
      <div className="text-center space-y-5 animate-in">
        <p className="text-8xl sm:text-9xl font-heading font-extrabold gradient-text tracking-tighter leading-none">
          404
        </p>
        <h1 className="text-xl font-heading font-semibold">
          Page not found
        </h1>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          The page you&apos;re looking for doesn&apos;t exist or has been
          moved.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground
            hover:bg-primary/90 active:bg-primary/80 transition-all shadow-lg shadow-primary/20"
        >
          <ArrowLeft className="h-4 w-4" />
          Go home
        </Link>
      </div>
    </div>
  );
}
