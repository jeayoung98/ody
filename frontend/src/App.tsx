import { useEffect, useState } from 'react'
import { fetchHello } from './api'
import './App.css'

type ApiState = 'checking' | 'connected' | 'unavailable'

function App() {
  const [apiState, setApiState] = useState<ApiState>('checking')
  const [apiMessage, setApiMessage] = useState('Backend 연결을 확인하고 있어요.')

  useEffect(() => {
    const controller = new AbortController()

    fetchHello(controller.signal)
      .then((message) => {
        setApiState('connected')
        setApiMessage(message)
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setApiState('unavailable')
        setApiMessage('Backend에 연결할 수 없습니다.')
      })

    return () => controller.abort()
  }, [])

  return (
    <main>
      <section className="hero" aria-labelledby="page-title">
        <p className="eyebrow">OUR DISCOVERY, YOURS</p>
        <h1 id="page-title">ODY</h1>
        <p className="lead">음악을 발견하고, 나만의 여정을 기록하세요.</p>
        <div className={`api-state api-state--${apiState}`} role="status">
          <span aria-hidden="true" />
          {apiMessage}
        </div>
      </section>
    </main>
  )
}

export default App
