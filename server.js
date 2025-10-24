// === server.js - NİHAİ v23 - SOCKET TOKEN AUTH SON ÇÖZÜM ===

require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
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

// CORS Ayarları
const allowedOrigins = [process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000'];
console.log("Origin:", allowedOrigins);
const corsOptions = { origin: function (origin, callback) { if (!origin || allowedOrigins.indexOf(origin) !== -1) { callback(null, true); } else { console.warn("CORS engelledi:", origin); callback(new Error('Not allowed by CORS')); } }, credentials: true };
app.use(cors(corsOptions));

const io = new Server(server, { cors: corsOptions });

// Veritabanı Pool & Tablo Oluşturma
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
(async () => { try { await pool.connect(); console.log('DB Connected.'); await pool.query(`CREATE TABLE IF NOT EXISTS messages (...)`); console.log("'messages' OK."); await pool.query(`CREATE TABLE IF NOT EXISTS users (...)`); console.log("'users' OK."); await pool.query(`CREATE TABLE IF NOT EXISTS "user_sessions" (...)`); console.log("'user_sessions' OK."); } catch (err) { console.error('DB Init Hata:', err); process.exit(1); } })();

// Oturum Ayarları (HTTP için)
const sessionMiddleware = session({ store: new pgSession({ pool : pool, tableName : 'user_sessions' }), secret: process.env.SESSION_SECRET, resave: false, saveUninitialized: false, cookie: { maxAge: 30 * 24 * 60 * 60 * 1000, secure: true, httpOnly: true, sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax' } });
app.use(sessionMiddleware);
// Session'ı Socket.IO'ya bağlamaya ARTIK GEREK YOK (io.use(wrap...) kaldırıldı)

// --- SOCKET.IO TOKEN AUTH ---
io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    console.log("--> io.use() Token Check. Token:", token);
    if (!token) return next(new Error('Auth token required'));
    try {
        const userId = parseInt(token, 10);
        if (isNaN(userId)) return next(new Error('Invalid token'));
        const result = await pool.query('SELECT id, username FROM users WHERE id = $1', [userId]);
        const user = result.rows[0];
        if (!user) return next(new Error('User not found for token'));
        socket.user = user; // Kullanıcıyı sokete ekle
        console.log(`--> io.use() Token Auth OK: User=${user.username}`);
        next();
    } catch (err) { console.error("--> io.use() Token Auth DB HATA:", err); next(new Error('Auth error')); }
});
// --- BİTTİ: SOCKET TOKEN AUTH ---

// Diğer Middleware'ler
app.use(express.json());
app.use(express.static('public'));

// Multer & Cloudinary (Aynı)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage, /* ... */ }).single('image');
cloudinary.config({ /* ... */ });

// Anlık Hafıza & Helper Fonksiyonlar (Aynı)
let connectedUsers = {};
function getUsersInRoom(roomName) { /* ... */ }
function findSocketIdByUsername(username) { /* ... */ }

// --- Rotalar (Login ve Check-Auth token dönecek) ---
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
        // Oturumu yine de kuralım (isteğe bağlı)
        req.session.user = { id: user.id, username: user.username };
        req.session.save((err) => {
             if (err) console.error('Login session save error:', err);
             console.log(`-> Giriş başarılı: ${username}. Token gönderiliyor.`);
             // Token olarak user.id'yi gönder
             res.status(200).json({ message: 'Giriş başarılı.', user: req.session.user, token: user.id.toString() });
        });
    } catch (err) { console.error('Giriş hatası:', err); res.status(500).json({ error: 'Sunucu hatası.' }); }
});
app.get('/check-auth', (req, res) => {
    if (req.session.user) {
        // Token olarak user.id'yi gönder
        res.status(200).json({ loggedIn: true, user: req.session.user, token: req.session.user.id.toString() });
    } else {
        res.status(200).json({ loggedIn: false });
    }
});
app.post('/logout', (req, res) => { /* ... */ });

// --- Socket.IO Olayları (socket.user kullanılacak) ---
io.on('connection', (socket) => {
    const currentUser = socket.user; // Session yerine buradan al
    if (!currentUser) { socket.disconnect(true); return; }
    const currentUserId = currentUser.id;
    const currentUsername = currentUser.username;
    console.log(`✅ Socket CONNECTED (Token): ${currentUsername} (${socket.id})`);

    socket.on('join chat', (data) => { /* ... (Kullanıcı adı currentUsername olacak) ... */ });
    socket.on('typing', () => { socket.broadcast.to(socket.room).emit('user typing', currentUsername); });
    socket.on('stop typing', () => { socket.broadcast.to(socket.room).emit('stop typing', currentUsername); });
    socket.on('chat message', (msg) => { /* ... (Kullanıcı adı currentUsername, ID currentUserId olacak) ... */ });
    socket.on('delete message', async (messageId) => { /* ... (Sahip kontrolü currentUserId ile) ... */ });
    socket.on('edit message', async (data) => { /* ... (Sahip kontrolü currentUserId ile) ... */ });
    socket.on('private message', (data) => { const from = currentUsername; /* ... */ });
    socket.on('disconnect', (reason) => { /* ... (Kullanıcı adı currentUsername veya connectedUsers'dan) ... */ });
    // Tam Socket.io kodu (Fazla uzun olduğu için kestim)
});

// --- Sunucuyu Başlat ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { console.log(`Sunucu ${PORT} portunda çalışıyor...`); });