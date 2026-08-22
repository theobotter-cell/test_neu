const required = (name: string): string => {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export const config = {
  vibeApiBase: process.env.VIBE_API_BASE || 'https://vibecode.bitrix24.com',
  vibeAppKey: required('VIBE_APP_KEY'),
  port: Number(process.env.PORT) || 3000,
}
