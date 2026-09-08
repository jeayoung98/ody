const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api'

export const apiBaseUrl = configuredBaseUrl.replace(/\/$/, '')

export async function fetchHello(signal?: AbortSignal): Promise<string> {
  const response = await fetch(`${apiBaseUrl}/hello`, {
    headers: { Accept: 'application/json' },
    signal,
  })

  if (!response.ok) {
    throw new Error(`API request failed with HTTP ${response.status}`)
  }

  const body: unknown = await response.json()
  if (typeof body === 'string') {
    return body
  }
  if (body && typeof body === 'object' && 'message' in body) {
    return String(body.message)
  }
  return 'API 연결 완료'
}
