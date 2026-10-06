"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import type * as React from "react";

export function AbsendenButton({
  children,
  bestaetigung,
  onClick,
  disabled,
  ...props
}: React.ComponentProps<typeof Button> & { bestaetigung?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      {...props}
      disabled={pending || disabled}
      onClick={(e) => {
        if (bestaetigung && !window.confirm(bestaetigung)) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
      }}
    >
      {pending ? "Bitte warten …" : children}
    </Button>
  );
}
