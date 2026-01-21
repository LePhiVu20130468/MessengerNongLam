//định nghĩa các object data, giúp code đẹp và tận dụng được TypeScript.
export interface WebSocketMessage {
    action?: string;
    data?: any;
    status?: string;
    event?: string;
}

export interface User {
    name: string;
    type?: number; // 0: user, 1: room
    actionTime?: string;
}

export interface ChatMessage {
    id?: number;
    to?: string;
    name?: string; // Người gửi
    mes: string;
    createAt?: string;
    type: 'people' | 'room' | 5 | number;
}