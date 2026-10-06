import { redirect } from "next/navigation";
import { sitzungErforderlich } from "@/lib/auth";
import { BeraterDashboard } from "@/components/dashboards/berater-dashboard";
import { CsDashboard } from "@/components/dashboards/cs-dashboard";
import { Leer } from "@/components/seitenkopf";

export default async function StartSeite({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { supabase, profil } = await sitzungErforderlich();

  if (profil.rolle === "kunde") {
    const { data: kunde } = await supabase.from("customers").select("id").eq("kunde_user_id", profil.id).maybeSingle();
    if (kunde) redirect(`/k/${kunde.id}`);
    return <Leer>Ihrem Zugang ist derzeit kein Kunde zugeordnet. Bitte wenden Sie sich an Linxys.</Leer>;
  }
  if (profil.rolle === "customer_success") {
    const { filter } = await searchParams;
    return <CsDashboard supabase={supabase} filter={filter} />;
  }
  return <BeraterDashboard supabase={supabase} profil={profil} />;
}
