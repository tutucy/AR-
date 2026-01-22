const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

const rooms = new Map();
const clients = new Map();

wss.on('connection', (ws) => {
    const clientId = Date.now() + Math.random().toString(36).substr(2, 9);
    clients.set(clientId, ws);
    console.log(`[${new Date().toLocaleTimeString()}] 客户端连接: ${clientId}`);
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log(`[${new Date().toLocaleTimeString()}] 收到消息 [${clientId}]:`, data.type);
            
            if (data.type === 'join') {
                const roomId = data.roomId;
                
                if (!rooms.has(roomId)) {
                    rooms.set(roomId, { host: ws, hostId: clientId, guest: null, guestId: null });
                    ws.send(JSON.stringify({ type: 'joined', role: 'host', roomId, clientId }));
                    console.log(`[${new Date().toLocaleTimeString()}] 房间 ${roomId} 创建成功，主机: ${clientId}`);
                } else {
                    const room = rooms.get(roomId);
                    if (!room.guest) {
                        room.guest = ws;
                        room.guestId = clientId;
                        ws.send(JSON.stringify({ type: 'joined', role: 'guest', roomId, clientId }));
                        room.host.send(JSON.stringify({ type: 'guest_joined' }));
                        console.log(`[${new Date().toLocaleTimeString()}] 房间 ${roomId} 客户端加入: ${clientId}`);
                    } else {
                        ws.send(JSON.stringify({ type: 'error', message: '房间已满' }));
                        console.log(`[${new Date().toLocaleTimeString()}] 房间 ${roomId} 已满`);
                    }
                }
            } else if (data.type === 'game_data') {
                const room = rooms.get(data.roomId);
                if (room) {
                    const isHost = ws === room.host;
                    const target = isHost ? room.guest : room.host;
                    const targetId = isHost ? room.guestId : room.hostId;
                    
                    console.log(`[${new Date().toLocaleTimeString()}] 转发游戏数据 ${isHost ? '主机→客户端' : '客户端→主机'}:`, data.data);
                    
                    if (target && target.readyState === WebSocket.OPEN) {
                        target.send(JSON.stringify({ type: 'game_data', data: data.data }));
                        console.log(`[${new Date().toLocaleTimeString()}] 数据已转发给: ${targetId}`);
                    } else {
                        console.log(`[${new Date().toLocaleTimeString()}] 目标连接不可用: ${targetId}`);
                    }
                } else {
                    console.log(`[${new Date().toLocaleTimeString()}] 房间不存在: ${data.roomId}`);
                }
            } else if (data.type === 'ping') {
                ws.send(JSON.stringify({ type: 'pong' }));
            } else if (data.type === 'leave') {
                const room = rooms.get(data.roomId);
                if (room) {
                    const isHost = ws === room.host;
                    const target = isHost ? room.guest : room.host;
                    const targetId = isHost ? room.guestId : room.hostId;
                    
                    if (target && target.readyState === WebSocket.OPEN) {
                        target.send(JSON.stringify({ type: 'opponent_left' }));
                        console.log(`[${new Date().toLocaleTimeString()}] 通知对方离开: ${targetId}`);
                    }
                    rooms.delete(data.roomId);
                    console.log(`[${new Date().toLocaleTimeString()}] 房间 ${data.roomId} 已删除`);
                }
            }
        } catch (error) {
            console.error(`[${new Date().toLocaleTimeString()}] 消息处理错误:`, error);
        }
    });
    
    ws.on('close', () => {
        console.log(`[${new Date().toLocaleTimeString()}] 客户端断开: ${clientId}`);
        clients.delete(clientId);
        
        for (const [roomId, room] of rooms.entries()) {
            if (room.hostId === clientId || room.guestId === clientId) {
                const isHost = room.hostId === clientId;
                const target = isHost ? room.guest : room.host;
                const targetId = isHost ? room.guestId : room.hostId;
                
                if (target && target.readyState === WebSocket.OPEN) {
                    target.send(JSON.stringify({ type: 'opponent_left' }));
                    console.log(`[${new Date().toLocaleTimeString()}] 通知对方断开: ${targetId}`);
                }
                rooms.delete(roomId);
                console.log(`[${new Date().toLocaleTimeString()}] 房间 ${roomId} 已删除`);
                break;
            }
        }
    });
    
    ws.on('error', (error) => {
        console.error(`[${new Date().toLocaleTimeString()}] WebSocket 错误 [${clientId}]:`, error.message);
    });
    
    ws.on('pong', () => {
        ws.isAlive = true;
    });
});

const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
            console.log(`[${new Date().toLocaleTimeString()}] 清理死连接`);
            return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
    });
}, 30000);

wss.on('close', () => {
    clearInterval(interval);
});

console.log('='.repeat(50));
console.log('WebSocket 服务器已启动');
console.log(`时间: ${new Date().toLocaleString()}`);
console.log('端口: 8080');
console.log('='.repeat(50));
