/** HTML-E-Mail-Vorlagen (schlicht, inline-Styles für E-Mail-Clients) */

export function esc(s: string | null | undefined): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function mailLayout(titel: string, inhaltHtml: string): string {
  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(titel)}</title></head>
<body style="margin:0;background:#f4f6f9;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#1e293b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:10px;border:1px solid #e2e8f0">
<tr><td style="padding:20px 24px;border-bottom:1px solid #e2e8f0;font-weight:600;font-size:16px"><span style="color:#1d4ed8">Linxys</span> Kundenportal</td></tr>
<tr><td style="padding:24px;font-size:14px;line-height:1.55">${inhaltHtml}</td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b">Diese E-Mail wurde automatisch vom Linxys Kundenportal versendet.</td></tr>
</table></td></tr></table></body></html>`;
}

export function knopf(link: string, text: string): string {
  return `<p style="margin:24px 0 8px"><a href="${esc(link)}" style="display:inline-block;background:#1d4ed8;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600">${esc(text)}</a></p>`;
}

/** Benachrichtigungs-E-Mail mit direktem Link zum Objekt */
export function benachrichtigungsMail(eingabe: { name: string; text: string; link: string | null }) {
  const anrede = `Hallo ${eingabe.name},`;
  const html = mailLayout(
    eingabe.text,
    `<p>${esc(anrede)}</p><p>${esc(eingabe.text)}</p>${eingabe.link ? knopf(eingabe.link, "Im Portal öffnen") : ""}`,
  );
  const text = `${anrede}\n\n${eingabe.text}\n${eingabe.link ? `\nIm Portal öffnen: ${eingabe.link}\n` : ""}`;
  return { html, text };
}
