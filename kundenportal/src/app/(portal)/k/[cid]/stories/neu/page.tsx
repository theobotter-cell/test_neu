import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ladeKundenKontext } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Seitenkopf } from "@/components/seitenkopf";
import { AktionForm } from "@/components/aktion-form";
import { AbsendenButton } from "@/components/absenden-button";
import { StoryFelder } from "@/components/story-formular";
import { storyAnlegen } from "@/lib/aktionen/stories";

export const metadata: Metadata = { title: "Neue Story" };

export default async function NeueStory({ params }: { params: Promise<{ cid: string }> }) {
  const { cid } = await params;
  const ctx = await ladeKundenKontext(cid);
  if (!ctx.darfMitwirken) notFound();
  return (
    <div className="max-w-3xl">
      <Seitenkopf titel="Neue Story" beschreibung="Die Story wird als Entwurf angelegt." />
      <Card>
        <CardContent>
          <AktionForm aktion={storyAnlegen.bind(null, cid)} className="grid gap-4">
            <StoryFelder />
            <AbsendenButton className="justify-self-start">Story anlegen</AbsendenButton>
          </AktionForm>
        </CardContent>
      </Card>
    </div>
  );
}
