// server.js - PairLink 免费 WebRTC 信令服务器
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // 允许任何前端页面连接
        methods: ["GET", "POST"]
    }
});

// 存储房间信息及设备状态
const rooms = new Map();

io.on('connection', (socket) => {
    console.log(`[连接成功] 设备已上线: ${socket.id}`);

    // 1. 创建或加入 6 位配对码房间
    socket.on('join-room', ({ roomId, deviceName, userEmail }) => {
        socket.join(roomId);
        socket.data.deviceName = deviceName;
        socket.data.userEmail = userEmail;

        if (!rooms.has(roomId)) {
            rooms.set(roomId, new Set());
        }
        rooms.get(roomId).add(socket.id);

        console.log(`[房间配对] 设备 ${deviceName} (${socket.id}) 加入房间: ${roomId}`);

        // 通知房间内的其他设备有新节点加入
        socket.to(roomId).emit('peer-joined', {
            peerId: socket.id,
            deviceName: deviceName,
            userEmail: userEmail
        });
    });

    // 2. WebRTC 握手信令转发 (Offer, Answer, ICE Candidates)
    socket.on('signal', ({ targetPeerId, signalData }) => {
        io.to(targetPeerId).emit('signal', {
            senderPeerId: socket.id,
            signalData: signalData
        });
    });

    // 3. 屏幕共享 / 远程控制请求与安全授权弹窗信令
    socket.on('request-control', ({ targetPeerId, requesterName }) => {
        io.to(targetPeerId).emit('control-requested', {
            requesterPeerId: socket.id,
            requesterName: requesterName
        });
    });

    socket.on('respond-control', ({ targetPeerId, accepted }) => {
        io.to(targetPeerId).emit('control-response', {
            responderPeerId: socket.id,
            accepted: accepted
        });
    });

    // 4. 设备断开连接处理
    socket.on('disconnect', () => {
        console.log(`[连接断开] 设备已下线: ${socket.id}`);
        rooms.forEach((peers, roomId) => {
            if (peers.has(socket.id)) {
                peers.delete(socket.id);
                socket.to(roomId).emit('peer-left', { peerId: socket.id });
                if (peers.size === 0) {
                    rooms.delete(roomId);
                }
            }
        });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 PairLink 信令服务器已在端口 ${PORT} 启动！`);
});