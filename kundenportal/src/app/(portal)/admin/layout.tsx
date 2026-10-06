import { rolleErforderlich } from "@/lib/auth";
import { Navigation } from "@/components/navigation";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await rolleErforderlich("admin");
  return (
    <div>
      <div className="mb-6 flex items-center justify-between border-b pb-3">
        <span className="font-semibold">Verwaltung</span>
        <Navigation
          eintraege={[
            { href: "/admin/kunden", label: "Kunden" },
            { href: "/admin/nutzer", label: "Nutzer" },
            { href: "/admin/audit", label: "Audit-Log" },
          ]}
        />
      </div>
      {children}
    </div>
  );
}
