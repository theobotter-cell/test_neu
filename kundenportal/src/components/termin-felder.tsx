import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Feld } from "@/components/feld";
import type { Profil, Termin } from "@/lib/types";

export function TerminFelder({
  termin,
  berater,
  standardBerater,
  heute,
}: {
  termin?: Termin;
  berater: Pick<Profil, "id" | "name">[];
  standardBerater?: string;
  heute: string;
}) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Feld label="Datum" htmlFor="datum">
          <Input id="datum" name="datum" type="date" defaultValue={termin?.datum ?? heute} required />
        </Feld>
        <Feld label="Titel" htmlFor="titel">
          <Input id="titel" name="titel" defaultValue={termin?.titel} required maxLength={200} />
        </Feld>
        <Feld label="Berater" htmlFor="berater_id">
          <Select id="berater_id" name="berater_id" defaultValue={termin?.berater_id ?? standardBerater ?? ""}>
            <option value="">–</option>
            {berater.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </Feld>
      </div>
      <Feld label="Transkript (Text)" htmlFor="transkript">
        <Textarea id="transkript" name="transkript" defaultValue={termin?.transkript ?? ""} rows={8} />
      </Feld>
      <Feld
        label={termin?.transkript_datei ? "Transkript-Datei ersetzen (optional)" : "Transkript-Datei (optional)"}
        htmlFor="datei"
        hinweis=".txt, .md, .vtt, .srt, .pdf, .doc, .docx – max. 20 MB"
      >
        <Input id="datei" name="datei" type="file" accept=".txt,.md,.vtt,.srt,.pdf,.doc,.docx" />
      </Feld>
    </div>
  );
}
