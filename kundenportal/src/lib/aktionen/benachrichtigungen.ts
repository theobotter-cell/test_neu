"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { AktionErgebnis } from "@/lib/types";

export async function alleGelesen(): Promise<AktionErgebnis> {
  const supabase = await createClient();
  await supabase.from("notifications").update({ gelesen: true }).eq("gelesen", false);
  revalidatePath("/", "layout");
  return { ok: true };
}
