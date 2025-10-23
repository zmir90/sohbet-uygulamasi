// === server.js - Socket Session PAYLAŞIMI DÜZELTİLDİ + DEBUG ===

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

function logRequests(req, res, next) { console.log(`=> REQ: ${req.method} ${req.originalUrl}`); next(); }

const app = express();
app.use(logRequests);
const server = http.createServer(app);
const io = new Server(server);

// Veritabanı Pool
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
// Tabloları oluştur/kontrol et
(async () => { try { await pool.connect(); console.log('Neon DB Connected.'); await pool.query(`CREATE TABLE IF NOT EXISTS messages (...)`); console.log("'messages' OK."); await pool.query(`CREATE TABLE IF NOT EXISTS users (...)`); console.log("'users' OK."); await pool.query(`CREATE TABLE IF NOT EXISTS "user_sessions" (...)`); console.log("'user_sessions' OK."); } catch (err) { console.error('DB Init Error:', err); process.exit(1); } })();
// Tam Create Table SQL'leri önceki mesajda var

// Oturum Ayarları
const sessionMiddleware = session({
    store: new pgSession({ pool : pool, tableName : 'user_sessions' }),
    secret: process.env.SESSION_SECRET,
    resave: false, saveUninitialized: false,
    cookie: { maxAge: 30 * 24 * 60 * 60 * 1000, secure: process.env.NODE_ENV === 'production', httpOnly: true }
});
app.use(sessionMiddleware); // Express için

// --- SOCKET.IO İÇİN SESSION PAYLAŞIMI (GÜNCELLENDİ) ---
// Socket.IO'nun her bağlantı isteğinde Express session middleware'ini kullanmasını sağla
const wrap = middleware => (socket, next) => middleware(socket.request, {}, next);
io.use(wrap(sessionMiddleware));

// Socket.IO Bağlantı Koruması (Log Eklendi)
io.use((socket, next) => {
    const session = socket.request.session;
    console.log("--> io.use() Auth Check: Session mevcut mu?", !!session); // DEBUG 1
    if (session) {
         console.log("    Session ID:", session.id); // DEBUG 2
         console.log("    Session User:", session.user); // DEBUG 3
    }

    if (session && session.user) {
        console.log(`--> io.use() Auth OK: User=${session.user.username}`); // DEBUG 4
        next();
    } else {
        console.error("--> io.use() Auth FAILED: Session veya User yok!"); // DEBUG 5
        next(new Error('Auth required')); // Bağlantıyı reddet
    }
});
// --- BİTTİ: SESSION PAYLAŞIMI ---


// Diğer Middleware'ler
app.use(express.json());
app.use(express.static('public'));

// Multer & Cloudinary Ayarları (Aynı)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage, /* ... Kalan ayarlar aynı ... */ }).single('image');
cloudinary.config({ /* ... ayarlar aynı ... */ });

// Anlık Hafıza & Helper Fonksiyonlar (Aynı)
let connectedUsers = {};
function getUsersInRoom(roomName) { /* ... */ }
function findSocketIdByUsername(username) { /* ... */ }

// Rotalar (Aynı)
app.get('/', (req, res) => { /* ... */ });
app.post('/upload', (req, res) => { /* ... */ });
app.post('/register', async (req, res) => { /* ... */ });
app.post('/login', async (req, res) => { /* ... */ });
app.get('/check-auth', (req, res) => { /* ... */ });
app.post('/logout', (req, res) => { /* ... */ });

// Socket.IO Olayları (Aynı)
io.on('connection', (socket) => { /* ... İçerik aynı (Seviye 13.4 final) ... */ });

// Sunucuyu Başlat (Aynı)
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { console.log(`Sunucu ${PORT} portunda çalışıyor...`); });