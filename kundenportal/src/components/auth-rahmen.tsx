import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function AuthRahmen({ titel, beschreibung, children }: { titel: string; beschreibung?: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <p className="mb-6 text-center text-lg font-semibold tracking-tight">
          <span className="text-primary">Linxys</span> Kundenportal
        </p>
        <Card>
          <CardHeader>
            <CardTitle>{titel}</CardTitle>
            {beschreibung && <CardDescription>{beschreibung}</CardDescription>}
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
      </div>
    </main>
  );
}
