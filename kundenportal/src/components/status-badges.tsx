import { Badge } from "@/components/ui/badge";
import type { StoryStatus, TicketPrioritaet, TicketStatus } from "@/lib/types";
import { STORY_STATUS_LABEL, TICKET_PRIORITAET_LABEL, TICKET_STATUS_LABEL } from "@/lib/workflow";

export function StoryStatusBadge({ status }: { status: StoryStatus }) {
  const variant =
    status === "abgenommen" ? "success"
    : status === "geschaetzt" || status === "zur_abnahme" ? "warning"
    : status === "entwurf" ? "outline"
    : "secondary";
  return <Badge variant={variant}>{STORY_STATUS_LABEL[status]}</Badge>;
}

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  const variant =
    status === "erledigt" ? "success" : status === "wartet_auf_kunde" ? "warning" : status === "neu" ? "outline" : "secondary";
  return <Badge variant={variant}>{TICKET_STATUS_LABEL[status]}</Badge>;
}

export function PrioritaetBadge({ prioritaet }: { prioritaet: TicketPrioritaet }) {
  const variant =
    prioritaet === "kritisch" ? "destructive" : prioritaet === "hoch" ? "danger" : prioritaet === "niedrig" ? "outline" : "secondary";
  return <Badge variant={variant}>{TICKET_PRIORITAET_LABEL[prioritaet]}</Badge>;
}
