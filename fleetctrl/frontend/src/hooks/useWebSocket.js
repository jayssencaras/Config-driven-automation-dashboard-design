import { useCallback, useEffect, useRef, useState } from 'react';

export function useWebSocket(url) {
  const [messages, setMessages] = useState([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const reconnectRef = useRef(false);

  const send = useCallback((data) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(typeof data === 'string' ? data : JSON.stringify(data));
    }
  }, []);

  useEffect(() => {
    let ws;
    let cancelled = false;

    function connect() {
      ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (cancelled) return;
        setConnected(true);
      };

      ws.onmessage = (ev) => {
        try {
          const parsed = JSON.parse(ev.data);
          setMessages((m) => [...m, parsed]);
        } catch {
          setMessages((m) => [...m, { raw: ev.data }]);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        if (!cancelled && !reconnectRef.current) {
          reconnectRef.current = true;
          setTimeout(() => {
            if (!cancelled) connect();
          }, 1000);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    reconnectRef.current = false;
    connect();

    return () => {
      cancelled = true;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [url]);

  return { messages, send, connected };
}
