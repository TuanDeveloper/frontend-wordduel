import { useEffect, useRef, useCallback, useState } from 'react'
import { WS_URL } from '../lib/api'

export type WsMessage = Record<string, unknown>

interface UseRoomSocketOptions {
  code: string
  token: string | null
  onMessage: (msg: WsMessage) => void
}

export function useRoomSocket({ code, token, onMessage }: UseRoomSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const onMessageRef = useRef(onMessage)

  useEffect(() => {
    onMessageRef.current = onMessage
  }, [onMessage])

  useEffect(() => {
    if (!code) return

    const url = token
      ? `${WS_URL}/ws/${code}?token=${token}`
      : `${WS_URL}/ws/${code}`

    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      setError(null)
    }

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data) as WsMessage
        onMessageRef.current(msg)
      } catch {
        // ignore parse errors
      }
    }

    ws.onerror = () => {
      setError('Mất kết nối WebSocket')
    }

    ws.onclose = () => {
      setConnected(false)
    }

    return () => {
      ws.close()
    }
  }, [code, token])

  const send = useCallback((msg: WsMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg))
    }
  }, [])

  return { connected, error, send }
}
