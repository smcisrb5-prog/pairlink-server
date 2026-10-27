const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    maxHttpBufferSize: 50 * 1024 * 1024 
});

// 存储设备名称映射: socket.id -> deviceName
const deviceNames = {};

io.on('connection', (socket) => {
    console.log('用户已连接:', socket.id);
    deviceNames[socket.id] = '网页设备';

    // 加入房间并同步双端状态
    socket.on('join-room', ({ roomId, deviceName }) => {
        if (deviceName) {
            deviceNames[socket.id] = deviceName;
        }
        socket.join(roomId);
        console.log(`用户 ${socket.id} (${deviceNames[socket.id]}) 加入房间: ${roomId}`);

        // 1. 通知房间内的其他老成员
        socket.to(roomId).emit('peer-joined', { 
            peerId: socket.id, 
            deviceName: deviceNames[socket.id] 
        });

        // 2. 将房间里已存在的其他成员信息发给新加入的人（双向互通关键修复）
        const socketsInRoom = io.sockets.adapter.rooms.get(roomId);
        if (socketsInRoom) {
            for (const clientId of socketsInRoom) {
                if (clientId !== socket.id) {
                    socket.emit('peer-joined', { 
                        peerId: clientId, 
                        deviceName: deviceNames[clientId] || '远端设备' 
                    });
                }
            }
        }
    });

    // 文件中继
    socket.on('relay-file', ({ targetPeerId, fileName, fileData, fileType }) => {
        console.log(`正在通过云端中继向 ${targetPeerId} 转发文件: ${fileName}`);
        io.to(targetPeerId).emit('relay-file', { fileName, fileData, fileType });
    });

    // 屏幕共享帧中继
    socket.on('relay-screen', ({ targetPeerId, frame }) => {
        io.to(targetPeerId).emit('relay-screen-frame', { frame });
    });

    socket.on('disconnect', () => {
        delete deviceNames[socket.id];
        console.log('用户已断开:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`服务器正在监听端口 ${PORT}`);
});