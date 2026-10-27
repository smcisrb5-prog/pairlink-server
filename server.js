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

// 儲存裝置名稱對應表: socket.id -> deviceName
const deviceNames = {};

io.on('connection', (socket) => {
    console.log('使用者已連線:', socket.id);
    deviceNames[socket.id] = '未命名裝置';

    // 加入房間並同步雙端狀態
    socket.on('join-room', ({ roomId, deviceName }) => {
        if (deviceName) {
            deviceNames[socket.id] = deviceName;
        }
        socket.join(roomId);
        console.log(`使用者 ${socket.id} (${deviceNames[socket.id]}) 已加入房間: ${roomId}`);

        // 1. 通知房間內的舊成員
        socket.to(roomId).emit('peer-joined', { 
            peerId: socket.id, 
            deviceName: deviceNames[socket.id] 
        });

        // 2. 將房間內已存在的成員資訊回傳給新加入者
        const socketsInRoom = io.sockets.adapter.rooms.get(roomId);
        if (socketsInRoom) {
            for (const clientId of socketsInRoom) {
                if (clientId !== socket.id) {
                    socket.emit('peer-joined', { 
                        peerId: clientId, 
                        deviceName: deviceNames[clientId] || '遠端裝置' 
                    });
                }
            }
        }
    });

    // 裝置名稱即時更新
    socket.on('update-device-name', ({ roomId, deviceName }) => {
        if (deviceName) {
            deviceNames[socket.id] = deviceName;
            if (roomId) {
                socket.to(roomId).emit('peer-device-updated', { peerId: socket.id, deviceName });
            }
        }
    });

    // 檔案中繼傳輸
    socket.on('relay-file', ({ targetPeerId, fileName, fileData, fileType }) => {
        console.log(`正在轉發檔案至 ${targetPeerId}: ${fileName}`);
        io.to(targetPeerId).emit('relay-file', { 
            fileName, 
            fileData, 
            fileType,
            senderName: deviceNames[socket.id] || '遠端裝置'
        });
    });

    // 畫面共享串流畫面中繼
    socket.on('relay-screen', ({ targetPeerId, frame }) => {
        io.to(targetPeerId).emit('relay-screen-frame', { 
            frame,
            senderName: deviceNames[socket.id] || '遠端裝置'
        });
    });

    socket.on('disconnect', () => {
        delete deviceNames[socket.id];
        console.log('使用者已斷線:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`伺服器正在聆聽連接埠 ${PORT}`);
});