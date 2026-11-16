import { notFound } from "next/navigation";
import LocalTest from "./LocalTest";

export const dynamic = "force-dynamic";
export default function Page() {
  if (process.env.SIMUS_V003_LOCAL_TEST !== "1") notFound();
  return <LocalTest />;
}
