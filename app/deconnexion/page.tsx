import { redirect } from "next/navigation";
import { fermerSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Page() {
  await fermerSession();
  redirect("/");
}
