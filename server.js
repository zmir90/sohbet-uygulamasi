// === server.js - NİHAİ v22 - SOCKET TOKEN AUTH ===

require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
// ... (Diğer require'lar aynı: multer, path, Pool, cloudinary, streamifier, session, pgSession, bcrypt, cors)
const multer = require('multer');
const path = require('path');
const { Pool } = require('pg');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const bcrypt = require('bcrypt');
const saltRounds = 10;
const cors = require('cors');


function logRequests(req, res, next) { console.log(`=> REQ: ${req.method} ${req.originalUrl}`); next(); }

const app = express();
app.use(logRequests);
const server = http.createServer(app);

// CORS Ayarları (Aynı)
const allowedOrigins = [process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000']; console.log("Origin:", allowedOrigins);
const corsOptions = { /* ... içerik aynı ... */ }; app.use(cors(corsOptions));
// Tam corsOptions:
const corsOptions = { origin: function (origin, callback) { if (!origin || allowedOrigins.indexOf(origin) !== -1) { callback(null, true); } else { console.warn("CORS engelledi:", origin); callback(new Error('Not allowed by CORS')); } }, credentials: true };


const io = new Server(server, { cors: corsOptions });

// Veritabanı Pool & Tablo Oluşturma (Aynı)
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
(async () => { try { await pool.connect(); console.log('DB Connected.'); await pool.query(`CREATE TABLE IF NOT EXISTS messages (...)`); console.log("'messages' OK."); await pool.query(`CREATE TABLE IF NOT EXISTS users (...)`); console.log("'users' OK."); await pool.query(`CREATE TABLE IF NOT EXISTS "user_sessions" (...)`); console.log("'user_sessions' OK."); } catch (err) { console.error('DB Init Hata:', err); process.exit(1); } })();
// Tam Create Table SQL'leri önceki mesajda var

// Oturum Ayarları (HTTP için hala gerekli)
const sessionMiddleware = session({ /* ... içerik aynı ... */ }); app.use(sessionMiddleware);
// Tam sessionMiddleware:
const sessionMiddleware = session({ store: new pgSession({ pool : pool, tableName : 'user_sessions' }), secret: process.env.SESSION_SECRET, resave: false, saveUninitialized: false, cookie: { maxAge: 30 * 24 * 60 * 60 * 1000, secure: true, httpOnly: true, sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax' } }); // Secure true yaptık


// --- SOCKET.IO İÇİN TOKEN AUTH (YENİ) ---
io.use(async (socket, next) => {
    const token = socket.handshake.auth.token; // İstemciden gelen token'ı al
    console.log("--> io.use() Token Auth Check Başladı. Gelen Token:", token); // DEBUG 1

    if (!token) {
        console.error("--> io.use() Token Auth FAILED: Token yok!"); // DEBUG 2
        return next(new Error('Authentication token required'));
    }

    try {
        // Token'ı kullanıcı ID'si olarak varsayıyoruz (basitlik için)
        const userId = parseInt(token, 10);
        if (isNaN(userId)) {
             console.error("--> io.use() Token Auth FAILED: Geçersiz token formatı!"); // DEBUG 3
             return next(new Error('Invalid token'));
        }

        // Kullanıcıyı veritabanından ID ile bul
        const result = await pool.query('SELECT id, username FROM users WHERE id = $1', [userId]);
        const user = result.rows[0];

        if (!user) {
            console.error(`--> io.use() Token Auth FAILED: ID ${userId} ile kullanıcı bulunamadı!`); // DEBUG 4
            return next(new Error('User not found for token'));
        }

        // BAŞARILI: Kullanıcı bilgilerini sokete ekle
        socket.user = user; // Artık socket.request.session yerine socket.user kullanacağız
        console.log(`--> io.use() Token Auth OK: User=${user.username}`); // DEBUG 5
        next(); // Bağlantıya izin ver

    } catch (err) {
        console.error("--> io.use() Token Auth DB HATA:", err); // DEBUG 6
        next(new Error('Authentication error'));
    }
});
// --- BİTTİ: SOCKET TOKEN AUTH ---


// Diğer Middleware'ler (Aynı)
app.use(express.json());
app.use(express.static('public'));

// Multer & Cloudinary Ayarları (Aynı)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage, /* ... */ }).single('image');
cloudinary.config({ /* ... */ });

// Anlık Hafıza & Helper Fonksiyonlar (Aynı)
let connectedUsers = {};
function getUsersInRoom(roomName) { /* ... */ }
function findSocketIdByUsername(username) { /* ... */ }

// --- Rotalar (Login ve Check-Auth Güncellendi) ---
app.get('/', (req, res) => { res.sendFile(__dirname + '/index.html'); });
app.post('/upload', (req, res) => { /* ... */ });
app.post('/register', async (req, res) => { /* ... */ });

app.post('/login', async (req, res) => {
    console.log("-> /login isteği"); const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Eksik bilgi.' });
    try {
        const result = await pool.query('SELECT id, username, password_hash FROM users WHERE username = $1', [username]);
        const user = result.rows[0];
        if (!user) return res.status(401).json({ error: 'Kullanıcı bulunamadı.' });
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) return res.status(401).json({ error: 'Yanlış şifre.' });

        // Oturumu yine de kuralım (belki başka HTTP istekleri için lazım olur)
        req.session.user = { id: user.id, username: user.username };
        req.session.save((err) => { // Kaydetmeyi bekle
             if (err) { console.error('Login session save error:', err); /* Hata olsa bile token dönebiliriz */ }
             console.log(`-> Giriş başarılı: ${username}. Token gönderiliyor.`);
             // BAŞARILI: Token olarak user.id'yi gönder
             res.status(200).json({ message: 'Giriş başarılı.', user: req.session.user, token: user.id.toString() }); // token eklendi
        });
    } catch (err) { console.error('Giriş hatası:', err); res.status(500).json({ error: 'Sunucu hatası.' }); }
});

app.get('/check-auth', (req, res) => {
    if (req.session.user) {
        // Oturum varsa, token olarak user.id'yi gönder
        res.status(200).json({ loggedIn: true, user: req.session.user, token: req.session.user.id.toString() }); // token eklendi
    } else {
        res.status(200).json({ loggedIn: false });
    }
});

app.post('/logout', (req, res) => { /* ... içerik aynı ... */ });

// --- Socket.IO Olayları (Kullanıcı Bilgisi socket.user'dan Alınacak) ---
io.on('connection', (socket) => {
    // Artık socket.user'dan alıyoruz, session'a gerek yok
    const currentUser = socket.user;
    if (!currentUser) { console.error("SOCKET CONNECT ERR: socket.user tanımsız!"); socket.disconnect(true); return; }
    const currentUserId = currentUser.id;
    const currentUsername = currentUser.username;
    console.log(`✅ Socket CONNECTED: ${currentUsername} (${socket.id})`);

    socket.on('join chat', (data) => {
        console.log(`--> ${currentUsername} 'join chat':`, data);
        const { room } = data; if (!room) return;
        if (socket.room) { socket.leave(socket.room); }
        socket.join(room); socket.room = room; // Odayı hala sokete kaydediyoruz
        connectedUsers[socket.id] = { username: currentUsername, room }; // Anlık liste için
        console.log(`   -> ${currentUsername} joined ${room}`);
        socket.emit('room joined', room);
        io.to(room).emit('update user list', getUsersInRoom(room));
        socket.broadcast.to(room).emit('user joined', currentUsername);
        (async () => { /* ... history load aynı ... */ })();
    });

    socket.on('typing', () => { socket.broadcast.to(socket.room).emit('user typing', currentUsername); });
    socket.on('stop typing', () => { socket.broadcast.to(socket.room).emit('stop typing', currentUsername); });

    socket.on('chat message', (msg) => {
        console.log(`--> ${currentUsername} 'chat message': ...`);
        const room = socket.room; if (!currentUsername || !room) return;
        socket.broadcast.to(room).emit('stop typing', currentUsername);
        const messageData = { username: currentUsername, message: msg }; // socket.user'dan gelen ad
        io.to(room).emit('chat message', messageData);
        const sql = `INSERT INTO messages (room, username, message, user_id) VALUES ($1, $2, $3, $4)`;
        pool.query(sql, [room, currentUsername, msg, currentUserId], (err, res) => { if (err) console.error('Msg save error:', err); });
    });

    socket.on('delete message', async (messageId) => {
        console.log(`--> ${currentUsername} 'delete message': ${messageId}`);
        const room = socket.room; if (!currentUsername || !room || !messageId) return;
        try {
            // Sahibini kontrol ederken currentUserId'yi kullanıyoruz
            const result = await pool.query('SELECT user_id FROM messages WHERE id = $1 AND room = $2', [messageId, room]);
            const messageOwnerId = result.rows[0]?.user_id;
            if (messageOwnerId && messageOwnerId === currentUserId) { /* ... silme işlemi aynı ... */ }
            else { /* ... hata aynı ... */ }
        } catch (err) { /* ... hata aynı ... */ }
    });

    socket.on('edit message', async (data) => {
        console.log(`--> ${currentUsername} 'edit message':`, data);
        const { messageId, newMessage } = data; const room = socket.room;
        if (!currentUsername || !room || !messageId || newMessage === undefined) return;
        try {
            // Sahibini kontrol ederken currentUserId'yi kullanıyoruz
            const result = await pool.query('SELECT user_id FROM messages WHERE id = $1 AND room = $2 AND is_deleted = FALSE', [messageId, room]);
            const messageOwnerId = result.rows[0]?.user_id;
            if (messageOwnerId && messageOwnerId === currentUserId) { /* ... düzenleme işlemi aynı ... */ }
            else { /* ... hata aynı ... */ }
        } catch (err) { /* ... hata aynı ... */ }
    });

    socket.on('private message', (data) => {
        console.log(`--> ${currentUsername} 'private message' to ${data.to}`);
        const from = currentUsername; // socket.user'dan gelen ad
        const { to, message } = data;
        const targetSocketId = findSocketIdByUsername(to);
        if (targetSocketId) { io.to(targetSocketId).emit('private message', { from, message }); socket.emit('private message', { to, message }); }
        else { socket.emit('notification', { text: `Hata: '${to}' bulunamadı.` }); }
    });

    socket.on('disconnect', (reason) => {
        const username = connectedUsers[socket.id]?.username || currentUsername || '?'; // Güvenli ad
        console.log(`❌ Socket DISCONNECTED: ${username} (${socket.id}), Reason: ${reason}`);
        const userData = connectedUsers[socket.id];
        if (userData) { const roomToNotify = userData.room; delete connectedUsers[socket.id]; if (roomToNotify) { io.to(roomToNotify).emit('update user list', getUsersInRoom(roomToNotify)); socket.broadcast.to(roomToNotify).emit('user left', username); socket.broadcast.to(roomToNotify).emit('stop typing', username); } }
    });
});

// --- Sunucuyu Başlat ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { console.log(`Sunucu ${PORT} portunda çalışıyor...`); });