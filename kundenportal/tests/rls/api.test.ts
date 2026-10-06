/**
 * Mandantentrennung über die echte Supabase-API (Auth, PostgREST, Storage).
 * Läuft, wenn SUPABASE_URL, SUPABASE_ANON_KEY und SUPABASE_SERVICE_ROLE_KEY
 * gesetzt sind (CI: nach "supabase start"), mit den Logins aus seed.sql.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const URL_ = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PASSWORT = "Linxys2026!";
const A = "10000000-0000-4000-a000-000000000001";
const B = "10000000-0000-4000-a000-000000000002";

async function anmelden(email: string): Promise<SupabaseClient> {
  const c = createClient(URL_!, ANON!, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: PASSWORT });
  if (error) throw error;
  return c;
}

describe.skipIf(!URL_ || !ANON || !SERVICE)("Supabase-API: Kunde A ↔ Kunde B", () => {
  let kundeA: SupabaseClient;
  let beraterOhne: SupabaseClient;
  let service: SupabaseClient;
  let dateiB = "";

  beforeAll(async () => {
    service = createClient(URL_!, SERVICE!, { auth: { persistSession: false } });
    kundeA = await anmelden("kunde@muster-handel.test");
    // Berater ohne Zuordnung zu B: Anna betreut nur Kunde A
    beraterOhne = await anmelden("anna.berger@linxys.test");
    const { data: termin } = await service.from("meetings").select("id").eq("customer_id", B).limit(1).single();
    dateiB = `${B}/${termin!.id}/api-test.txt`;
    const { error } = await service.storage.from("transkripte").upload(dateiB, new Blob(["geheim"], { type: "text/plain" }), { upsert: true });
    if (error) throw error;
  });

  afterAll(async () => {
    await service?.storage.from("transkripte").remove([dateiB]);
  });

  const tabellen = ["customers", "kontingente", "stories", "tickets", "time_entries", "comments", "approvals", "meetings", "kontingent_stand"];

  for (const [name, client] of [["Kunde A", () => kundeA], ["Berater ohne Zuordnung", () => beraterOhne]] as const) {
    it(`${name} liest keine Daten von Kunde B`, async () => {
      for (const t of tabellen) {
        const spalte = t === "customers" ? "id" : "customer_id";
        const { data, error } = await client().from(t).select("*").eq(spalte, B);
        expect(error, t).toBeNull();
        expect(data, t).toEqual([]);
      }
    });

    it(`${name} schreibt keine Daten bei Kunde B`, async () => {
      const versuche = [
        client().from("stories").insert({ customer_id: B, titel: "x" }),
        client().from("tickets").insert({ customer_id: B, titel: "x" }),
        client().from("time_entries").insert({ customer_id: B, datum: "2026-01-01", dauer_stunden: 1, kategorie: "beratung" }),
        client().from("kontingente").insert({ customer_id: B, leistung: "x", stunden: 1 }),
        client().from("meetings").insert({ customer_id: B, datum: "2026-01-01", titel: "x" }),
        client().from("comments").insert({ customer_id: B, story_id: "20000000-0000-4000-a000-000000000008", text: "x" }),
      ];
      for (const v of versuche) expect((await v).error).not.toBeNull();
      const upd = await client().from("stories").update({ titel: "gehackt" }).eq("customer_id", B).select();
      expect(upd.data ?? []).toEqual([]);
      const rpc = await client().rpc("story_transition", { p_story_id: "20000000-0000-4000-a000-000000000009", p_nach_status: "zur_umsetzung_freigegeben" });
      expect(rpc.error).not.toBeNull();
    });

    it(`${name} kann Transkript-Dateien von Kunde B weder laden noch hochladen`, async () => {
      const dl = await client().storage.from("transkripte").download(dateiB);
      expect(dl.data).toBeNull();
      const signiert = await client().storage.from("transkripte").createSignedUrl(dateiB, 60);
      expect(signiert.data).toBeNull();
      const liste = await client().storage.from("transkripte").list(B);
      expect(liste.data ?? []).toEqual([]);
      const up = await client().storage.from("transkripte").upload(`${dateiB}.neu`, new Blob(["x"]), { contentType: "text/plain" });
      expect(up.error).not.toBeNull();
    });
  }

  it("Positivkontrolle: Kunde B lädt die eigene Datei, Kunde A sieht eigene Daten", async () => {
    const kundeB = await anmelden("kunde@beispiel-logistik.test");
    const dl = await kundeB.storage.from("transkripte").download(dateiB);
    expect(await dl.data?.text()).toBe("geheim");
    const { data } = await kundeA.from("stories").select("id").eq("customer_id", A);
    expect(data!.length).toBeGreaterThan(0);
  });
});
