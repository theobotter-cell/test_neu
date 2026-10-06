import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Beschriftetes Formularfeld */
export function Feld({
  label,
  htmlFor,
  hinweis,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  hinweis?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hinweis && <p className="text-xs text-muted-foreground">{hinweis}</p>}
    </div>
  );
}
