import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function getServerSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session;
}

export async function requireServerSession() {
  const session = await getServerSession();
  if (!session) {
    return null;
  }
  return session;
}
