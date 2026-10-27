const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);

// 初始化 Socket.io，放大缓冲区至 50MB 以支持大文件云端中继
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    maxHttpBufferSize: 50 * 1024 * 1024 
});

io.on('connection', (socket) => {
    console.log('用户已连接:', socket.id);

    // 加入 4 位配对码房间
    socket.on('join-room', ({ roomId }) => {
        socket.join(roomId);
        // 通知房间内的其他设备
        socket.to(roomId).emit('peer-joined', { peerId: socket.id });
        console.log(`用户 ${socket.id} 已加入房间: ${roomId}`);
    });

    // 1. 云端文件安全中继
    socket.on('relay-file', ({ targetPeerId, fileName, fileData, fileType }) => {
        console.log(`正在通过云端中继向 ${targetPeerId} 转发文件: ${fileName}`);
        io.to(targetPeerId).emit('relay-file', { fileName, fileData, fileType });
    });

    // 2. 云端屏幕画面帧中继 (Canvas 截图流)
    socket.on('relay-screen', ({ targetPeerId, frame }) => {
        io.to(targetPeerId).emit('relay-screen-frame', { frame });
    });

    socket.on('disconnect', () => {
        console.log('用户已断开:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`服务器正在监听端口 ${PORT}`);
});