import "server-only";

export type Mail = { an: string; betreff: string; html: string; text: string };

/** Austauschbarer E-Mail-Anbieter */
export interface MailProvider {
  readonly name: string;
  senden(mail: Mail): Promise<void>;
}

/** Resend (EU-Region im Resend-Projekt wählen; API-Endpunkt ist identisch) */
class ResendProvider implements MailProvider {
  readonly name = "resend";
  constructor(
    private apiKey: string,
    private absender: string,
  ) {}

  async senden(mail: Mail) {
    const antwort = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: this.absender, to: [mail.an], subject: mail.betreff, html: mail.html, text: mail.text }),
    });
    if (!antwort.ok) {
      throw new Error(`Resend ${antwort.status}: ${(await antwort.text()).slice(0, 300)}`);
    }
  }
}

/** Entwicklung: schreibt E-Mails nur ins Server-Log */
class KonsolenProvider implements MailProvider {
  readonly name = "konsole";
  async senden(mail: Mail) {
    console.info(`[E-Mail] an=${mail.an} betreff=${mail.betreff}\n${mail.text}`);
  }
}

export function mailProvider(): MailProvider {
  const art = process.env.MAIL_PROVIDER ?? "konsole";
  const absender = process.env.MAIL_FROM ?? "Linxys Kundenportal <portal@linxys.de>";
  switch (art) {
    case "resend": {
      const key = process.env.RESEND_API_KEY;
      if (!key) throw new Error("RESEND_API_KEY ist nicht gesetzt");
      return new ResendProvider(key, absender);
    }
    case "konsole":
      return new KonsolenProvider();
    default:
      throw new Error(`Unbekannter MAIL_PROVIDER: ${art}`);
  }
}
