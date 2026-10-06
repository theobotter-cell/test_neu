import type { Metadata } from "next";
import { rolleErforderlich } from "@/lib/auth";
import { CsDashboard } from "@/components/dashboards/cs-dashboard";

export const metadata: Metadata = { title: "Kunden" };

export default async function KundenSeite({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { supabase } = await rolleErforderlich("admin", "berater", "customer_success");
  const { filter } = await searchParams;
  return <CsDashboard supabase={supabase} filter={filter} basis="/kunden" titel="Kunden" />;
}
