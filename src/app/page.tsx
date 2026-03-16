import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SourceSelector } from "@/components/dashboard/source-selector";
import type { DataSource } from "@/types";
import { Database, Zap, BarChart3, Github, MessageSquare } from "lucide-react";

function FeatureCard({
  icon,
  title,
  description,
  delay,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  delay: string;
}) {
  return (
    <div
      className={`group relative rounded-xl border border-border bg-card/50 backdrop-blur-sm p-6 space-y-3
        hover:border-primary/30 hover:bg-card/80 transition-all duration-300 animate-in ${delay}`}
    >
      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
        {icon}
      </div>
      <h3 className="font-bold text-lg tracking-tight">{title}</h3>
      <p className="text-[15px] text-muted-foreground leading-relaxed">
        {description}
      </p>
    </div>
  );
}

function LandingPage() {
  return (
    <main className="min-h-dvh relative overflow-hidden">
      <div className="absolute inset-0 gradient-mesh pointer-events-none" />

      <div className="relative z-10">
        {/* Nav */}
        <header className="flex items-center justify-between px-6 md:px-10 py-5">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Database className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-xl tracking-tight">Vox</span>
          </div>
          <Link
            href="/auth/github"
            className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium
              hover:bg-secondary/80 transition-colors"
          >
            <Github className="h-4 w-4" />
            Sign in
          </Link>
        </header>

        {/* Hero */}
        <section className="flex flex-col items-center text-center px-6 pt-20 pb-24 md:pt-32 md:pb-32 max-w-4xl mx-auto">
          <div className="animate-in inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-8">
            <Zap className="h-3 w-3" />
            AI-powered database queries
          </div>

          <h1 className="animate-in-delay-1 font-extrabold text-4xl sm:text-5xl md:text-6xl lg:text-7xl tracking-tight leading-[1.1]">
            Ask Your{" "}
            <span className="gradient-text">Database</span>
            <br />
            Anything
          </h1>

          <p className="animate-in-delay-2 mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl leading-relaxed">
            Connect your PostgreSQL database and query it in plain English.
            Vox generates SQL, streams results in real time, and presents
            data you can actually understand.
          </p>

          <div className="animate-in-delay-3 mt-10 flex flex-col sm:flex-row items-center gap-4">
            <Link
              href="/auth/github"
              className="inline-flex items-center gap-2.5 h-12 px-7 rounded-xl bg-primary text-primary-foreground font-medium text-base
                hover:bg-primary/90 active:bg-primary/80 transition-all shadow-lg shadow-primary/20"
            >
              <Github className="h-5 w-5" />
              Continue with GitHub
            </Link>
            <span className="text-sm text-muted-foreground">
              Free and open source
            </span>
          </div>
        </section>

        {/* Features */}
        <section className="px-6 md:px-10 pb-24 max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <FeatureCard
              icon={<MessageSquare className="h-5 w-5" />}
              title="Natural Language SQL"
              description="Type questions in plain English. Vox's AI agent understands your schema and generates precise, read-only SQL queries."
              delay="animate-in-delay-1"
            />
            <FeatureCard
              icon={<Zap className="h-5 w-5" />}
              title="Real-time Streaming"
              description="Watch answers form in real time with server-sent events. See the SQL being generated, then the results as they arrive."
              delay="animate-in-delay-2"
            />
            <FeatureCard
              icon={<BarChart3 className="h-5 w-5" />}
              title="Instant Results"
              description="Query results are displayed in clean, sortable tables right in the chat. No context switching, no separate tools."
              delay="animate-in-delay-3"
            />
          </div>
        </section>
      </div>
    </main>
  );
}

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <LandingPage />;
  }

  const { data } = await supabase
    .from("data_sources")
    .select("id, user_id, name, db_type, status, created_at, updated_at, last_tested_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  return <SourceSelector initialSources={(data ?? []) as DataSource[]} />;
}
