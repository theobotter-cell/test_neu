"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient, type ServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { appUrl } from "@/lib/config";
import { fehlerText } from "@/lib/fehler";
import type { AktionErgebnis, Rolle } from "@/lib/types";
import { ID, ersterFehler, optText, text } from "./hilfen";

/**
 * Prüft serverseitig, dass der aktuelle Nutzer admin ist. (Die Datenbank prüft
 * zusätzlich per RLS; die Prüfung hier schützt die Auth-Admin-API, die mit dem
 * Service-Role-Key arbeitet.)
 */
async function adminErforderlich(): Promise<ServerClient> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet");
  const { data: profil } = await supabase.from("profiles").select("rolle, aktiv").eq("id", user.id).single();
  if (profil?.rolle !== "admin" || !profil.aktiv) throw new Error("Nur für Administratoren");
  return supabase;
}

const NutzerDaten = z.object({
  name: z.string().min(1, "Bitte einen Namen angeben.").max(200),
  email: z.string().email("Bitte eine gültige E-Mail-Adresse angeben.").max(320),
  rolle: z.enum(["admin", "berater", "customer_success", "kunde"]),
  buchungslink: z.string().regex(/^https:\/\/\S+$/i, "Der Buchungslink muss mit https:// beginnen.").nullable(),
});

/**
 * Lädt einen Nutzer per E-Mail ein und legt sein Profil an.
 * Gibt die neue User-ID zurück.
 */
async function nutzerEinladenIntern(
  supabase: ServerClient,
  eingabe: { name: string; email: string; rolle: Rolle; buchungslink: string | null },
): Promise<{ id: string } | { fehler: string }> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(eingabe.email, {
    data: { name: eingabe.name },
    redirectTo: `${appUrl()}/auth/confirm?weiter=/passwort-setzen`,
  });
  if (error || !data.user) {
    const vorhanden = /already|registered|exists/i.test(error?.message ?? "");
    return { fehler: vorhanden ? "Zu dieser E-Mail-Adresse existiert bereits ein Zugang." : "Die Einladung konnte nicht versendet werden." };
  }
  // Profil im Kontext des admins anlegen (RLS: nur admin darf Profile anlegen)
  const { error: profilFehler } = await supabase.from("profiles").insert({
    id: data.user.id,
    name: eingabe.name,
    email: eingabe.email.toLowerCase(),
    rolle: eingabe.rolle,
    buchungslink: eingabe.rolle === "berater" || eingabe.rolle === "admin" ? eingabe.buchungslink : null,
  });
  if (profilFehler) {
    await admin.auth.admin.deleteUser(data.user.id);
    return { fehler: fehlerText(profilFehler) };
  }
  return { id: data.user.id };
}

export async function nutzerEinladen(_: AktionErgebnis, daten: FormData): Promise<AktionErgebnis> {
  const supabase = await adminErforderlich();
  const eingabe = NutzerDaten.safeParse({
    name: text(daten, "name"),
    email: text(daten, "email"),
    rolle: text(daten, "rolle"),
    buchungslink: optText(daten, "buchungslink"),
  });
  if (!eingabe.success) return { ok: false, fehler: ersterFehler(eingabe.error) };
  if (eingabe.data.rolle === "kunde") {
    return { ok: false, fehler: "Kunden-Logins werden beim Kunden angelegt (genau ein Login pro Kunde)." };
  }
  const r = await nutzerEinladenIntern(supabase, eingabe.data);
  if ("fehler" in r) return { ok: false, fehler: r.fehler };
  revalidatePath("/admin/nutzer");
  return { ok: true, meldung: `Einladung an ${eingabe.data.email} versendet.` };
}

/** Profil eines internen Nutzers bearbeiten (Name, Buchungslink, Rolle) */
export async function nutzerAktualisieren(nutzerId: string, _: AktionErgebnis, daten: FormData): Promise<AktionErgebnis> {
  const supabase = await adminErforderlich();
  const id = ID.safeParse(nutzerId);
  if (!id.success) return { ok: false, fehler: "Ungültiger Nutzer." };
  const rolle = text(daten, "rolle");
  const name = text(daten, "name");
  const buchungslink = optText(daten, "buchungslink");
  if (!name) return { ok: false, fehler: "Bitte einen Namen angeben." };
  if (buchungslink && !/^https:\/\/\S+$/i.test(buchungslink)) return { ok: false, fehler: "Der Buchungslink muss mit https:// beginnen." };

  const { data: alt } = await supabase.from("profiles").select("rolle").eq("id", id.data).single();
  const aenderung: Record<string, unknown> = { name, buchungslink };
  if (rolle && alt?.rolle !== "kunde") {
    if (!["admin", "berater", "customer_success"].includes(rolle)) return { ok: false, fehler: "Ungültige Rolle." };
    aenderung.rolle = rolle;
  }
  const { error } = await supabase.from("profiles").update(aenderung).eq("id", id.data);
  if (error) return { ok: false, fehler: fehlerText(error) };
  revalidatePath("/admin/nutzer");
  return { ok: true, meldung: "Gespeichert." };
}

/** Login (de)aktivieren: Profil-Flag + Sperre in Supabase Auth */
export async function nutzerAktivSetzen(nutzerId: string, aktiv: boolean): Promise<AktionErgebnis> {
  const supabase = await adminErforderlich();
  const id = ID.safeParse(nutzerId);
  if (!id.success) return { ok: false, fehler: "Ungültiger Nutzer." };
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.id === id.data && !aktiv) return { ok: false, fehler: "Sie können sich nicht selbst deaktivieren." };

  const { error } = await supabase.from("profiles").update({ aktiv }).eq("id", id.data);
  if (error) return { ok: false, fehler: fehlerText(error) };
  await createAdminClient().auth.admin.updateUserById(id.data, { ban_duration: aktiv ? "none" : "876000h" });
  revalidatePath("/admin/nutzer");
  return { ok: true, meldung: aktiv ? "Zugang aktiviert." : "Zugang deaktiviert." };
}

export async function einladungErneutSenden(nutzerId: string): Promise<AktionErgebnis> {
  const supabase = await adminErforderlich();
  const { data: profil } = await supabase.from("profiles").select("email").eq("id", nutzerId).single();
  if (!profil) return { ok: false, fehler: "Nutzer nicht gefunden." };
  const { error } = await supabase.auth.resetPasswordForEmail(profil.email, {
    redirectTo: `${appUrl()}/auth/confirm?weiter=/passwort-setzen`,
  });
  if (error) return { ok: false, fehler: "Die E-Mail konnte nicht versendet werden." };
  return { ok: true, meldung: "Link zum Festlegen des Passworts wurde versendet." };
}

// ---------------------------------------------------------------------------
// Kunden
// ---------------------------------------------------------------------------
const KundenDaten = z.object({
  firmenname: z.string().min(1, "Bitte den Firmennamen angeben.").max(200),
  hauptberater_id: ID.nullable(),
  bericht_intervall: z.enum(["woechentlich", "monatlich", "aus"]),
  bitrix_company_id: z.string().max(50).nullable(),
});

export async function kundeAnlegen(_: AktionErgebnis, daten: FormData): Promise<AktionErgebnis> {
  const supabase = await adminErforderlich();
  const eingabe = KundenDaten.safeParse({
    firmenname: text(daten, "firmenname"),
    hauptberater_id: optText(daten, "hauptberater_id"),
    bericht_intervall: text(daten, "bericht_intervall") || "monatlich",
    bitrix_company_id: optText(daten, "bitrix_company_id"),
  });
  if (!eingabe.success) return { ok: false, fehler: ersterFehler(eingabe.error) };

  const loginName = text(daten, "login_name");
  const loginEmail = text(daten, "login_email");
  if ((loginName && !loginEmail) || (!loginName && loginEmail)) {
    return { ok: false, fehler: "Für den Kunden-Login bitte Name und E-Mail angeben (oder beides leer lassen)." };
  }

  const { data: kunde, error } = await supabase.from("customers").insert(eingabe.data).select("id").single();
  if (error) return { ok: false, fehler: fehlerText(error) };

  if (loginEmail) {
    const login = NutzerDaten.safeParse({ name: loginName, email: loginEmail, rolle: "kunde", buchungslink: null });
    if (!login.success) return { ok: false, fehler: `Kunde angelegt, aber: ${ersterFehler(login.error)}` };
    const r = await nutzerEinladenIntern(supabase, login.data);
    if ("fehler" in r) return { ok: false, fehler: `Kunde angelegt, aber Einladung fehlgeschlagen: ${r.fehler}` };
    const { error: zuordnung } = await supabase.rpc("kunde_login_wechseln", { p_customer_id: kunde.id, p_neuer_user_id: r.id });
    if (zuordnung) return { ok: false, fehler: fehlerText(zuordnung) };
  }
  revalidatePath("/admin/kunden");
  revalidatePath("/kunden");
  redirect(`/admin/kunden/${kunde.id}`);
}

export async function kundeAktualisieren(customerId: string, _: AktionErgebnis, daten: FormData): Promise<AktionErgebnis> {
  const supabase = await adminErforderlich();
  const id = ID.safeParse(customerId);
  const eingabe = KundenDaten.safeParse({
    firmenname: text(daten, "firmenname"),
    hauptberater_id: optText(daten, "hauptberater_id"),
    bericht_intervall: text(daten, "bericht_intervall"),
    bitrix_company_id: optText(daten, "bitrix_company_id"),
  });
  if (!id.success) return { ok: false, fehler: "Ungültiger Kunde." };
  if (!eingabe.success) return { ok: false, fehler: ersterFehler(eingabe.error) };
  const { error } = await supabase.from("customers").update(eingabe.data).eq("id", id.data);
  if (error) return { ok: false, fehler: fehlerText(error) };
  revalidatePath(`/admin/kunden/${id.data}`);
  revalidatePath(`/k/${id.data}`, "layout");
  return { ok: true, meldung: "Gespeichert." };
}

export async function beraterZuordnen(customerId: string, _: AktionErgebnis, daten: FormData): Promise<AktionErgebnis> {
  const supabase = await adminErforderlich();
  const cid = ID.safeParse(customerId);
  const bid = ID.safeParse(text(daten, "berater_id"));
  if (!cid.success || !bid.success) return { ok: false, fehler: "Bitte einen Berater wählen." };
  const { error } = await supabase.from("customer_consultants").insert({ customer_id: cid.data, berater_id: bid.data });
  if (error) return { ok: false, fehler: fehlerText(error) };
  revalidatePath(`/admin/kunden/${cid.data}`);
  return { ok: true, meldung: "Berater zugeordnet." };
}

export async function beraterEntfernen(customerId: string, beraterId: string): Promise<AktionErgebnis> {
  const supabase = await adminErforderlich();
  const { error } = await supabase
    .from("customer_consultants")
    .delete()
    .eq("customer_id", customerId)
    .eq("berater_id", beraterId);
  if (error) return { ok: false, fehler: fehlerText(error) };
  revalidatePath(`/admin/kunden/${customerId}`);
  return { ok: true, meldung: "Zuordnung entfernt." };
}

/**
 * Ansprechpartner wechseln: neuer Login wird eingeladen und übernimmt den
 * Kunden, der alte Login wird deaktiviert (Profil + Auth-Sperre) – protokolliert.
 */
export async function ansprechpartnerWechseln(customerId: string, _: AktionErgebnis, daten: FormData): Promise<AktionErgebnis> {
  const supabase = await adminErforderlich();
  const cid = ID.safeParse(customerId);
  if (!cid.success) return { ok: false, fehler: "Ungültiger Kunde." };
  const eingabe = NutzerDaten.safeParse({
    name: text(daten, "name"),
    email: text(daten, "email"),
    rolle: "kunde",
    buchungslink: null,
  });
  if (!eingabe.success) return { ok: false, fehler: ersterFehler(eingabe.error) };

  const { data: kunde } = await supabase.from("customers").select("kunde_user_id").eq("id", cid.data).single();
  const r = await nutzerEinladenIntern(supabase, eingabe.data);
  if ("fehler" in r) return { ok: false, fehler: r.fehler };

  const { error } = await supabase.rpc("kunde_login_wechseln", { p_customer_id: cid.data, p_neuer_user_id: r.id });
  if (error) return { ok: false, fehler: fehlerText(error) };
  if (kunde?.kunde_user_id) {
    await createAdminClient().auth.admin.updateUserById(kunde.kunde_user_id, { ban_duration: "876000h" });
  }
  revalidatePath(`/admin/kunden/${cid.data}`);
  return { ok: true, meldung: `${eingabe.data.name} wurde eingeladen und ist jetzt Ansprechpartner. Der bisherige Login ist deaktiviert.` };
}
