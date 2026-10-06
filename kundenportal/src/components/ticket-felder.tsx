import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Feld } from "@/components/feld";
import { TICKET_PRIORITAET, TICKET_PRIORITAET_LABEL, TICKET_STATUS, TICKET_STATUS_LABEL, TICKET_TYP, TICKET_TYP_LABEL } from "@/lib/workflow";
import type { Profil, Ticket } from "@/lib/types";

export function TicketFelder({
  ticket,
  intern,
  berater = [],
}: {
  ticket?: Ticket;
  intern?: boolean;
  berater?: Pick<Profil, "id" | "name">[];
}) {
  return (
    <div className="grid gap-4">
      <Feld label="Titel" htmlFor="titel">
        <Input id="titel" name="titel" defaultValue={ticket?.titel} required maxLength={200} />
      </Feld>
      <Feld label="Beschreibung" htmlFor="beschreibung">
        <Textarea id="beschreibung" name="beschreibung" defaultValue={ticket?.beschreibung} rows={6} />
      </Feld>
      <div className="grid gap-4 sm:grid-cols-2">
        <Feld label="Typ" htmlFor="typ">
          <Select id="typ" name="typ" defaultValue={ticket?.typ ?? "frage"} required>
            {TICKET_TYP.map((t) => (
              <option key={t} value={t}>
                {TICKET_TYP_LABEL[t]}
              </option>
            ))}
          </Select>
        </Feld>
        <Feld label="Priorität" htmlFor="prioritaet">
          <Select id="prioritaet" name="prioritaet" defaultValue={ticket?.prioritaet ?? "normal"} required>
            {TICKET_PRIORITAET.map((p) => (
              <option key={p} value={p}>
                {TICKET_PRIORITAET_LABEL[p]}
              </option>
            ))}
          </Select>
        </Feld>
        {intern && ticket && (
          <>
            <Feld label="Status" htmlFor="status">
              <Select id="status" name="status" defaultValue={ticket.status}>
                {TICKET_STATUS.map((s) => (
                  <option key={s} value={s}>
                    {TICKET_STATUS_LABEL[s]}
                  </option>
                ))}
              </Select>
            </Feld>
            <Feld label="Zuständig" htmlFor="zustaendig_id">
              <Select id="zustaendig_id" name="zustaendig_id" defaultValue={ticket.zustaendig_id ?? ""}>
                <option value="">– niemand –</option>
                {berater.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </Feld>
            <Feld label="Fällig am" htmlFor="faellig_am">
              <Input id="faellig_am" name="faellig_am" type="date" defaultValue={ticket.faellig_am ?? ""} />
            </Feld>
          </>
        )}
      </div>
    </div>
  );
}
