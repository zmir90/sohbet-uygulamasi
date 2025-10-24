// === server.js - NİHAİ v21 - LOGIN DEBUG ARTTIRILDI ===

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
console.log("İzin verilen Origin:", allowedOrigins);
const corsOptions = { origin: function (origin, callback) { if (!origin || allowedOrigins.indexOf(origin) !== -1) { callback(null, true); } else { console.warn("CORS engelledi:", origin); callback(new Error('Not allowed by CORS')); } }, credentials: true };
app.use(cors(corsOptions));

const io = new Server(server, { cors: corsOptions });

// Veritabanı Pool
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// Tabloları oluştur/kontrol et
(async () => { try { await pool.connect(); console.log('DB Connected.'); await pool.query(`CREATE TABLE IF NOT EXISTS messages (...)`); console.log("'messages' OK."); await pool.query(`CREATE TABLE IF NOT EXISTS users (...)`); console.log("'users' OK."); await pool.query(`CREATE TABLE IF NOT EXISTS "user_sessions" (...)`); console.log("'user_sessions' OK."); } catch (err) { console.error('DB Init Hata:', err); process.exit(1); } })();
// Tam Create Table SQL'leri önceki mesajda var

// Oturum Ayarları
const sessionMiddleware = session({ store: new pgSession({ pool : pool, tableName : 'user_sessions' }), secret: process.env.SESSION_SECRET, resave: false, saveUninitialized: false, cookie: { maxAge: 30 * 24 * 60 * 60 * 1000, secure: process.env.NODE_ENV === 'production', httpOnly: true, sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax' } });
app.use(sessionMiddleware);
const wrap = middleware => (socket, next) => middleware(socket.request, {}, next);
io.use(wrap(sessionMiddleware));

// Diğer Middleware'ler
app.use(express.json()); // JSON body parser'ı session'dan SONRA ama rotalardan ÖNCE olmalı
app.use(express.static('public'));

// Multer & Cloudinary Ayarları (Aynı)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage, /* ... */ }).single('image');
cloudinary.config({ /* ... */ });

// Anlık Hafıza & Helper Fonksiyonlar (Aynı)
let connectedUsers = {};
function getUsersInRoom(roomName) { /* ... */ }
function findSocketIdByUsername(username) { /* ... */ }

// --- Rotalar ---
app.get('/', (req, res) => { res.sendFile(__dirname + '/index.html'); });
app.post('/upload', (req, res) => { /* ... */ });
app.post('/register', async (req, res) => { /* ... */ });

// --- LOGIN ROTASI (DETAYLI LOGLARLA) ---
app.post('/login', async (req, res) => {
    console.log("-> /login isteği alındı. Body:", req.body); // LOG 1
    const { username, password } = req.body;
    if (!username || !password) {
        console.log("   -> Login Hata: Eksik bilgi.");
        return res.status(400).json({ error: 'Eksik bilgi.' });
    }
    try {
        console.log(`   -> Kullanıcı aranıyor: ${username}`); // LOG 2
        const result = await pool.query('SELECT id, username, password_hash FROM users WHERE username = $1', [username]);
        const user = result.rows[0];

        if (!user) {
            console.log(`   -> Login Hata: Kullanıcı bulunamadı (${username})`); // LOG 3
            return res.status(401).json({ error: 'Kullanıcı bulunamadı.' });
        }
        console.log(`   -> Kullanıcı bulundu: ${username}. Şifre karşılaştırılıyor...`); // LOG 4

        const match = await bcrypt.compare(password, user.password_hash);

        if (!match) {
            console.log(`   -> Login Hata: Yanlış şifre (${username})`); // LOG 5
            return res.status(401).json({ error: 'Yanlış şifre.' });
        }
        console.log(`   -> Şifre doğru (${username}). Oturum ayarlanıyor...`); // LOG 6

        // Oturumu ayarla
        req.session.user = { id: user.id, username: user.username };
        console.log(`   -> req.session.user ayarlandı:`, req.session.user); // LOG 7

        // Oturumu kaydetmeyi bekle (Explicit save)
        req.session.save((err) => {
            if (err) {
                console.error('   -> Login Hata: OTURUM KAYDEDİLEMEDİ!', err); // LOG 8 (KRİTİK)
                // Hata olsa bile devam etmeyi deneyelim mi? Hayır, hata verelim.
                return res.status(500).json({ error: 'Oturum kaydedilirken hata oluştu.' });
            }
            console.log(`   -> Oturum başarıyla kaydedildi. Yanıt gönderiliyor... (User: ${username})`); // LOG 9
            res.status(200).json({ message: 'Giriş başarılı.', user: req.session.user }); // JSON yanıtını gönder
        });

    } catch (err) {
        console.error('Login rotası CATCH bloğu hatası:', err); // LOG 10
        // Catch bloğu bile JSON göndermeli, HTML değil!
        res.status(500).json({ error: 'Sunucu tarafında bir hata oluştu.' });
    }
});
// --- BİTTİ: LOGIN ROTASI ---

app.get('/check-auth', (req, res) => { /* ... içerik aynı ... */ });
app.post('/logout', (req, res) => { /* ... içerik aynı ... */ });

// --- Socket.IO ---
io.use((socket, next) => { /* ... Auth check logları ... */ });
io.on('connection', (socket) => { /* ... Tüm olaylar aynı ... */ });

// --- Sunucuyu Başlat ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { console.log(`Sunucu ${PORT} portunda çalışıyor...`); });