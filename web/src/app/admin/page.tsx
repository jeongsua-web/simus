import { headers } from "next/headers";
import { localAdminBypass } from "@/lib/auth/local-admin";
import AdminClient from "./AdminClient";

export default async function AdminPage() {
  return <AdminClient localDev={localAdminBypass(await headers())} />;
}
