// === server.js - NİHAİ v15 - CORS EKLENDİ ===

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
// --- YENİ: CORS Kütüphanesi ---
const cors = require('cors');

function logRequests(req, res, next) { console.log(`=> REQ: ${req.method} ${req.originalUrl}`); next(); }

const app = express();
app.use(logRequests);
const server = http.createServer(app);

// --- YENİ: CORS AYARLARI ---
// Render'daki sitenizin tam adresini buraya yazın (httpS ile!)
// Lokal test için http://localhost:3000 ekleyebilirsiniz.
const allowedOrigins = [process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000'];
console.log("İzin verilen Origin:", allowedOrigins); // Debug için

const corsOptions = {
  origin: function (origin, callback) {
    // Mobil uygulamalar veya REST istemcileri için 'origin' olmayabilir (örn: Postman)
    // Aynı origin veya izin verilenler listesindeyse izin ver
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn("CORS tarafından engellenen origin:", origin); // Hangi origin'in engellendiğini gör
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true // Çerezlerin gönderilmesine izin ver! (ÇOK ÖNEMLİ)
};
app.use(cors(corsOptions)); // CORS middleware'ini kullan
// --- BİTTİ: CORS AYARLARI ---


const io = new Server(server, {
    // --- YENİ: Socket.IO için CORS Ayarları ---
    cors: corsOptions
    // --- BİTTİ: Socket.IO CORS ---
});

// Veritabanı Pool
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// Tabloları oluştur/kontrol et
(async () => { /* ... içerik aynı ... */ })();
// Tam kod:
(async () => { try { await pool.connect(); console.log('DB Connected.'); await pool.query(`CREATE TABLE IF NOT EXISTS messages (...)`); console.log("'messages' OK."); await pool.query(`CREATE TABLE IF NOT EXISTS users (...)`); console.log("'users' OK."); await pool.query(`CREATE TABLE IF NOT EXISTS "user_sessions" (...)`); console.log("'user_sessions' OK."); } catch (err) { console.error('DB Init Hata:', err); process.exit(1); } })();

// Oturum Ayarları
const sessionMiddleware = session({ store: new pgSession({ pool : pool, tableName : 'user_sessions' }), secret: process.env.SESSION_SECRET, resave: false, saveUninitialized: false, cookie: { maxAge: 30 * 24 * 60 * 60 * 1000, secure: process.env.NODE_ENV === 'production', httpOnly: true, sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax' } }); // sameSite eklendi
app.use(sessionMiddleware);
const wrap = middleware => (socket, next) => middleware(socket.request, {}, next);
io.use(wrap(sessionMiddleware));

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

// Socket.IO (Aynı, loglar dahil)
io.use((socket, next) => { /* ... Auth check logları ... */ });
io.on('connection', (socket) => { /* ... Tüm socket olayları aynı ... */ });

// Sunucuyu Başlat (Aynı)
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { console.log(`Sunucu ${PORT} portunda çalışıyor...`); });