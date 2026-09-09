import { render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import App from './App'

afterEach(() => {
  vi.restoreAllMocks()
})

test('renders the ODY landing page and confirms the API connection', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ message: 'hello' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  )

  render(<App />)

  expect(screen.getByRole('heading', { name: 'ODY' })).toBeInTheDocument()
  expect(await screen.findByText('hello')).toBeInTheDocument()
  expect(globalThis.fetch).toHaveBeenCalledWith(
    '/api/hello',
    expect.objectContaining({ headers: { Accept: 'application/json' } }),
  )
})
