import { useEffect, useRef, useState, useCallback } from 'react';
import { WebSocketMessage } from './types';

const SOCKET_URL = "wss://chat.longapp.site/chat/chat";

export const useWebSocket = () => {
    const ws = useRef<WebSocket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [latestData, setLatestData] = useState<WebSocketMessage | null>(null);

    const [retryCount, setRetryCount] = useState(0);

    useEffect(() => {
        console.log("Connecting to WebSocket...");
        ws.current = new WebSocket(SOCKET_URL);

        ws.current.onopen = () => {
            console.log("Connected to WebSocket");
            setIsConnected(true);

            const savedCode = localStorage.getItem('re_login_code');
            const savedUser = localStorage.getItem('username');
            if (savedCode && savedUser) {
                ws.current?.send(JSON.stringify({
                    action: "onchat",
                    data: {
                        event: "RE_LOGIN",
                        data: { user: savedUser, code: savedCode }
                    }
                }));
            }
        };

        ws.current.onmessage = (event) => {
            try {
                const parsedData = JSON.parse(event.data);
                console.log("Received:", parsedData);
                setLatestData(parsedData);
            } catch (e) {
                console.error("Error parsing message", e);
            }
        };

        ws.current.onclose = () => {
            console.log("Disconnected. Retrying in 3 seconds...");
            setIsConnected(false);

            setTimeout(() => {
                setRetryCount(prev => prev + 1);
            }, 500);
        };

        ws.current.onerror = (err) => {
            console.error("WebSocket Error:", err);
            ws.current?.close();
        };

        return () => {
            ws.current?.close();
        };
    }, [retryCount]);

    const sendMessage = useCallback((data: any) => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({
                action: "onchat",
                data: data
            }));
        } else {
            console.warn("WebSocket not connected, message dropped");
        }
    }, []);

    return { isConnected, sendMessage, latestData };
};