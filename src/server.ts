import express, { Request, Response, NextFunction } from 'express'
import path from 'path'
import { config } from './config'
import { identityMiddleware, AuthedRequest } from './identity'
import { getDealHistoryPage, normalizePageParams, normalizeSearchQuery, searchDeals, validateDealId } from './dealHistory'
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

app.get('/api/deal-history/:dealId', identityMiddleware, async (req: AuthedRequest, res: Response) => {
  const dealId = validateDealId(req.params.dealId)
  if (dealId === null) {
    res.status(400).json({
      error: { code: 'INVALID_DEAL_ID', message: 'No valid Deal was provided by Bitrix24.' },
    })
    return
  }
  if (!req.bearer) {
    res.status(401).json({
      error: {
        code: 'SESSION_EXPIRED',
        message: 'This app must be opened from a Deal card.',
      },
    })
    return
  }

  const { order, offset, limit } = normalizePageParams(req.query.order, req.query.offset, req.query.limit)

  try {
    const page = await getDealHistoryPage(dealId, req.bearer, order, offset, limit)
    res.status(200).json(page)
  } catch (err) {
    const friendly = toFriendlyError(err)
    res.status(friendly.httpStatus).json({
      error: { code: friendly.code, message: friendly.message, retryable: friendly.retryable },
    })
  }
})

app.get('/api/deals/search', identityMiddleware, async (req: AuthedRequest, res: Response) => {
  const query = normalizeSearchQuery(req.query.q)
  if (query === null) {
    res.status(200).json({ results: [] })
    return
  }
  if (!req.bearer) {
    res.status(401).json({
      error: { code: 'SESSION_EXPIRED', message: 'Your session has expired. Please reopen this app.' },
    })
    return
  }

  try {
    const results = await searchDeals(query, req.bearer)
    res.status(200).json({ results })
  } catch (err) {
    const friendly = toFriendlyError(err)
    res.status(friendly.httpStatus).json({
      error: { code: friendly.code, message: friendly.message, retryable: friendly.retryable },
    })
  }
})

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
  console.log(`Deal Change History listening on :${config.port}`)
})
