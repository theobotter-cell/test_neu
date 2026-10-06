/** Nur relative, interne Weiterleitungsziele zulassen (kein Open Redirect) */
export function sicheresZiel(ziel: string | null | undefined, standard = "/"): string {
  if (!ziel || !ziel.startsWith("/") || ziel.startsWith("//") || ziel.startsWith("/\\")) return standard;
  return ziel;
}
