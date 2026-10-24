const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);

// 初始化 Socket.io，并放宽单次传输限制至 50MB 以支持云端中继传文件
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    maxHttpBufferSize: 50 * 1024 * 1024 
});

io.on('connection', (socket) => {
    console.log('用户已连接:', socket.id);

    socket.on('join-room', ({ roomId }) => {
        socket.join(roomId);
        // 通知房间内的其他设备
        socket.to(roomId).emit('peer-joined', { peerId: socket.id });
    });

    // WebRTC 信令转发
    socket.on('signal', ({ targetPeerId, signalData }) => {
        io.to(targetPeerId).emit('signal', { senderPeerId: socket.id, signalData });
    });

    // 🌟 新增：当 WebRTC 失败时的云端文件安全中继兜底
    socket.on('relay-file', ({ targetPeerId, fileName, fileData, fileType }) => {
        console.log(`正在通过云端中继向 ${targetPeerId} 转发文件: ${fileName}`);
        io.to(targetPeerId).emit('relay-file', { fileName, fileData, fileType });
    });

    socket.on('disconnect', () => {
        console.log('用户已断开:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`服务器正在监听端口 ${PORT}`);
});