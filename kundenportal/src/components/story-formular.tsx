import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Feld } from "@/components/feld";
import type { Story } from "@/lib/types";

export function StoryFelder({ story }: { story?: Pick<Story, "titel" | "beschreibung" | "akzeptanzkriterien"> }) {
  return (
    <div className="grid gap-4">
      <Feld label="Titel" htmlFor="titel">
        <Input id="titel" name="titel" defaultValue={story?.titel} required maxLength={200} />
      </Feld>
      <Feld label="Beschreibung" htmlFor="beschreibung" hinweis="Was soll erreicht werden und warum?">
        <Textarea id="beschreibung" name="beschreibung" defaultValue={story?.beschreibung} rows={6} />
      </Feld>
      <Feld label="Akzeptanzkriterien" htmlFor="akzeptanzkriterien" hinweis="Woran erkennen wir, dass die Story fertig ist?">
        <Textarea id="akzeptanzkriterien" name="akzeptanzkriterien" defaultValue={story?.akzeptanzkriterien} rows={5} />
      </Feld>
    </div>
  );
}
