import { vibeCall, vibeCallEnvelope } from './vibeClient'
import { ContactRecord, ContactStatsResponse } from './types'
import { getViewCount } from './viewStore'

const CONTACT_ENTITY_TYPE_ID = 3 // Bitrix24 CRM: contact
const EMAIL_ACTIVITY_TYPE_ID = 4 // Bitrix24 CRM activity: e-mail
const DIRECTION_INCOMING = 1
const DIRECTION_OUTGOING = 2

/** Accepts only a bare positive integer — never trusts the placement URL blindly. */
export function validateContactId(raw: string | undefined): number | null {
  if (!raw || !/^[1-9][0-9]*$/.test(raw)) return null
  const id = Number(raw)
  return Number.isSafeInteger(id) ? id : null
}

async function fetchContact(contactId: number, bearer: string): Promise<ContactRecord> {
  return vibeCall<ContactRecord>(`/v1/contacts/${contactId}`, { bearer })
}

interface ActivityAggregateResponse {
  count: number
}

async function countEmails(contactId: number, direction: number, bearer: string): Promise<number> {
  const result = await vibeCall<ActivityAggregateResponse>('/v1/activities/aggregate', {
    method: 'POST',
    bearer,
    body: {
      filter: {
        ownerTypeId: CONTACT_ENTITY_TYPE_ID,
        ownerId: contactId,
        typeId: EMAIL_ACTIVITY_TYPE_ID,
        direction,
      },
    },
  })
  return result.count
}

async function countTimelineComments(contactId: number, bearer: string): Promise<number> {
  const { meta } = await vibeCallEnvelope<unknown[]>('/v1/timelines/search', {
    method: 'POST',
    bearer,
    body: {
      filter: { entityType: 'contact', entityId: contactId },
      select: ['id'],
      limit: 1,
    },
  })
  return meta?.total ?? 0
}

function pick<T>(result: PromiseSettledResult<T>, label: string, unavailable: string[]): T | null {
  if (result.status === 'fulfilled') return result.value
  unavailable.push(label)
  return null
}

function contactDisplayName(contact: ContactRecord): string {
  const parts = [contact.name, contact.lastName].filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : `Contact #${contact.id}`
}

/**
 * Fetches contact info, e-mail counts, timeline comment count and the Insights
 * view counter concurrently. The contact fetch is the only fatal dependency —
 * everything else degrades gracefully into `unavailable`.
 */
export async function getContactStats(contactId: number, bearer: string): Promise<ContactStatsResponse> {
  const [contactResult, incomingResult, outgoingResult, commentsResult, viewsResult] = await Promise.allSettled([
    fetchContact(contactId, bearer),
    countEmails(contactId, DIRECTION_INCOMING, bearer),
    countEmails(contactId, DIRECTION_OUTGOING, bearer),
    countTimelineComments(contactId, bearer),
    getViewCount(contactId),
  ])

  if (contactResult.status === 'rejected') {
    throw contactResult.reason
  }
  const contact = contactResult.value

  const unavailable: string[] = []
  const incomingEmails = pick(incomingResult, 'incomingEmails', unavailable)
  const outgoingEmails = pick(outgoingResult, 'outgoingEmails', unavailable)
  const timelineComments = pick(commentsResult, 'timelineComments', unavailable)
  const totalEmails = incomingEmails !== null && outgoingEmails !== null ? incomingEmails + outgoingEmails : null

  const viewData =
    viewsResult.status === 'fulfilled' ? viewsResult.value : { views: 0, trackingSince: new Date().toISOString() }
  if (viewsResult.status === 'rejected') unavailable.push('views')

  return {
    contact: {
      id: contact.id,
      name: contactDisplayName(contact),
      createdAt: contact.createdTime,
    },
    statistics: {
      incomingEmails,
      outgoingEmails,
      totalEmails,
      timelineComments,
      views: viewData.views,
      viewMetricType: 'insights_views',
      trackingSince: viewData.trackingSince,
    },
    unavailable,
  }
}
