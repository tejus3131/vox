import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("app_meta")
      .select("id")
      .limit(1);

    if (error) {
      return NextResponse.json(
        { status: "degraded", error: "Database unreachable", version: getVersion() },
        { status: 503 }
      );
    }

    return NextResponse.json({
      status: "ok",
      version: getVersion(),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { status: "error", error: err instanceof Error ? err.message : "Unknown", version: getVersion() },
      { status: 500 }
    );
  }
}

function getVersion(): string {
  return process.env.APP_VERSION ?? process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev";
}
