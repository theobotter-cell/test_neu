import express, { Request, Response, NextFunction } from 'express'
import path from 'path'
import { config } from './config'
import { identityMiddleware, AuthedRequest } from './identity'
import { getContactStats, validateContactId } from './contactStats'
import { recordView } from './viewStore'
import { toFriendlyError } from './errors'

const app = express()

// Never send framing headers that would block Bitrix24 from embedding this app
// in its CRM iframe — Express sets none of these by default; this is a guard
// against a future dependency (e.g. helmet) silently adding them.
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.removeHeader('X-Frame-Options')
  res.removeHeader('Content-Security-Policy')
  next()
})

app.use(express.json({ limit: '32kb' }))
app.use(express.static(path.join(__dirname, '..', 'public')))

app.get('/health', (_req, res) => res.status(200).json({ ok: true }))

app.get(
  '/api/contact-stats/:contactId',
  identityMiddleware,
  async (req: AuthedRequest, res: Response) => {
    const contactId = validateContactId(req.params.contactId)
    if (contactId === null) {
      res.status(400).json({
        error: { code: 'INVALID_CONTACT_ID', message: 'No valid contact was provided by Bitrix24.' },
      })
      return
    }
    if (!req.bearer) {
      res.status(401).json({
        error: {
          code: 'SESSION_EXPIRED',
          message: 'Your session has expired. Please reopen this tab from the Contact card.',
        },
      })
      return
    }

    try {
      const stats = await getContactStats(contactId, req.bearer)
      res.status(200).json(stats)
    } catch (err) {
      const friendly = toFriendlyError(err)
      res.status(friendly.httpStatus).json({
        error: { code: friendly.code, message: friendly.message, retryable: friendly.retryable },
      })
    }
  },
)

app.post(
  '/api/contact-stats/:contactId/view',
  identityMiddleware,
  async (req: AuthedRequest, res: Response) => {
    const contactId = validateContactId(req.params.contactId)
    const nonce = typeof req.body?.nonce === 'string' ? req.body.nonce.slice(0, 128) : null
    if (contactId === null || !nonce) {
      res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Missing contact or view nonce.' } })
      return
    }
    if (!req.bearer) {
      res.status(401).json({ error: { code: 'SESSION_EXPIRED', message: 'Session expired.' } })
      return
    }

    try {
      const result = await recordView(contactId, nonce)
      res.status(200).json(result)
    } catch {
      // View tracking is best-effort — never surface this as a hard failure to the UI.
      res.status(200).json({ views: null, deduped: false })
    }
  },
)

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found.' } })
})

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const friendly = toFriendlyError(err)
  res.status(friendly.httpStatus).json({ error: { code: friendly.code, message: friendly.message } })
})

app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`Contact Insights listening on :${config.port}`)
})
