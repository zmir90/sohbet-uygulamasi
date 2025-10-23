// === SEVİYE 30.3 - GÜNCELLENMİŞ SERVER.JS (Beyaz Tahta Yayın) ===

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
const corsOptions = { origin: function (origin, callback) { if (!origin || allowedOrigins.indexOf(origin) !== -1) { callback(null, true); } else { console.warn("CORS engelledi:", origin); callback(new Error('Not allowed by CORS')); } }, credentials: true };
app.use(cors(corsOptions));
const io = new Server(server, { cors: corsOptions });

// Veritabanı Pool & Tablo Oluşturma (Aynı)
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
(async () => { try { await pool.connect(); console.log('DB Connected.'); await pool.query(`CREATE TABLE IF NOT EXISTS messages (...)`); console.log("'messages' OK."); await pool.query(`CREATE TABLE IF NOT EXISTS users (...)`); console.log("'users' OK."); await pool.query(`CREATE TABLE IF NOT EXISTS "user_sessions" (...)`); console.log("'user_sessions' OK."); } catch (err) { console.error('DB Init Hata:', err); process.exit(1); } })();
// Tam Create Table SQL'leri önceki mesajlarda var

// Oturum Ayarları & Paylaşım (Aynı)
const sessionMiddleware = session({ store: new pgSession({ pool : pool, tableName : 'user_sessions' }), secret: process.env.SESSION_SECRET, resave: false, saveUninitialized: false, cookie: { /*...*/ } });
app.use(sessionMiddleware);
const wrap = middleware => (socket, next) => middleware(socket.request, {}, next);
io.use(wrap(sessionMiddleware));

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

// Rotalar (Aynı)
app.get('/', (req, res) => { /* ... */ });
app.post('/upload', (req, res) => { /* ... */ });
app.post('/register', async (req, res) => { /* ... */ });
app.post('/login', async (req, res) => { /* ... */ });
app.get('/check-auth', (req, res) => { /* ... */ });
app.post('/logout', (req, res) => { /* ... */ });

// --- Socket.IO ---
io.use((socket, next) => { /* ... Auth check logları ... */ });

io.on('connection', (socket) => {
    const sessionUser = socket.request.session.user; if (!sessionUser) { socket.disconnect(true); return; }
    const currentUserId = sessionUser.id; const currentUsername = sessionUser.username;
    console.log(`✅ Socket CONNECTED: ${currentUsername} (${socket.id})`);

    // Odaya Katılma (Aynı)
    socket.on('join chat', (data) => { /* ... içerik aynı ... */ });

    // Yazıyor... (Aynı)
    socket.on('typing', () => { /* ... */ });
    socket.on('stop typing', () => { /* ... */ });

    // Genel Mesaj (Aynı)
    socket.on('chat message', (msg) => { /* ... */ });

    // Mesaj Silme (Aynı)
    socket.on('delete message', async (messageId) => { /* ... */ });

    // Mesaj Düzenleme (Aynı)
    socket.on('edit message', async (data) => { /* ... */ });

    // --- YENİ EKLENDİ: Beyaz Tahta Olayları ---
    socket.on('draw line', (data) => {
        // Gelen çizim verisini (data = {x1, y1, x2, y2, color})
        // gönderen kişi HARİÇ odadaki DİĞER herkese yayınla (`broadcast`)
        // console.log(`--> Draw event from ${currentUsername}:`, data); // Çok fazla log üretebilir
        if (socket.room) { // Kullanıcının bir odada olduğundan emin ol
             socket.broadcast.to(socket.room).emit('draw line', data);
        }
    });

    socket.on('clear board', () => {
        // "Tahtayı temizle" komutunu gönderen kişi HARİÇ odadaki DİĞER herkese yayınla
        console.log(`--> Clear board event from ${currentUsername}`); // DEBUG
         if (socket.room) {
             socket.broadcast.to(socket.room).emit('clear board');
        }
    });
    // --- BİTTİ: Beyaz Tahta Olayları ---

    // Özel Mesaj (Aynı)
    socket.on('private message', (data) => { /* ... */ });

    // Bağlantı Kesme (Aynı)
    socket.on('disconnect', (reason) => { /* ... */ });

}); // io.on('connection') bitişi

// --- Sunucuyu Başlat ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { console.log(`Sunucu ${PORT} portunda çalışıyor...`); });