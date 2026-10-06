import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Feld } from "@/components/feld";
import { BERICHT_LABEL } from "@/lib/workflow";
import type { Kunde, Profil } from "@/lib/types";

export function KundenFelder({ kunde, berater }: { kunde?: Kunde; berater: Pick<Profil, "id" | "name">[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Feld label="Firmenname" htmlFor="firmenname">
        <Input id="firmenname" name="firmenname" defaultValue={kunde?.firmenname} required />
      </Feld>
      <Feld label="Hauptberater" htmlFor="hauptberater_id">
        <Select id="hauptberater_id" name="hauptberater_id" defaultValue={kunde?.hauptberater_id ?? ""}>
          <option value="">– wählen –</option>
          {berater.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
      </Feld>
      <Feld label="Periodischer Bericht" htmlFor="bericht_intervall">
        <Select id="bericht_intervall" name="bericht_intervall" defaultValue={kunde?.bericht_intervall ?? "monatlich"}>
          {(Object.keys(BERICHT_LABEL) as (keyof typeof BERICHT_LABEL)[]).map((k) => (
            <option key={k} value={k}>
              {BERICHT_LABEL[k]}
            </option>
          ))}
        </Select>
      </Feld>
      <Feld label="Bitrix-Firmen-ID (optional)" htmlFor="bitrix_company_id" hinweis="Nur Referenz für Phase 2 (Bitrix-Synchronisation)">
        <Input id="bitrix_company_id" name="bitrix_company_id" defaultValue={kunde?.bitrix_company_id ?? ""} />
      </Feld>
    </div>
  );
}
