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
  const [reconnecting, setReconnecting] = useState(false)
  const onMessageRef = useRef(onMessage)

  useEffect(() => {
    onMessageRef.current = onMessage
  }, [onMessage])

  useEffect(() => {
    if (!code) return

    let disposed = false
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    let stableTimer: ReturnType<typeof setTimeout> | null = null
    let attempts = 0
    let socket: WebSocket | null = null

    const connect = () => {
      if (disposed) return
      const protocols = token ? ['wordduel', `bearer.${token}`] : ['wordduel']
      socket = new WebSocket(`${WS_URL}/ws/${encodeURIComponent(code)}`, protocols)
      wsRef.current = socket

      socket.onopen = () => {
        if (disposed) return
        setConnected(true)
        setReconnecting(false)
        setError(null)
        stableTimer = setTimeout(() => { attempts = 0 }, 10_000)
      }

      socket.onmessage = (event) => {
        try {
          onMessageRef.current(JSON.parse(event.data) as WsMessage)
        } catch {
          // Ignore messages that are not valid JSON objects.
        }
      }

      socket.onerror = () => {
        if (!disposed) setError('Mất kết nối WebSocket')
      }

      socket.onclose = () => {
        if (stableTimer) clearTimeout(stableTimer)
        if (disposed) return
        setConnected(false)
        setReconnecting(true)
        attempts += 1
        const backoffMs = Math.min(500 * (2 ** Math.min(attempts - 1, 6)), 30_000)
        const jitterMs = Math.floor(Math.random() * 250)
        retryTimer = setTimeout(connect, backoffMs + jitterMs)
      }
    }

    connect()
    return () => {
      disposed = true
      if (retryTimer) clearTimeout(retryTimer)
      if (stableTimer) clearTimeout(stableTimer)
      socket?.close()
      if (wsRef.current === socket) wsRef.current = null
    }
  }, [code, token])

  const send = useCallback((msg: WsMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg))
    }
  }, [])

  return { connected, error, reconnecting, send }
}
