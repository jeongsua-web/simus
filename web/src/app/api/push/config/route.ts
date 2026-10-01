import { json } from "@/lib/api";
export const runtime = "nodejs";
export async function GET() {
  return json({ public_key: process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT
    ? process.env.VAPID_PUBLIC_KEY : null });
}
