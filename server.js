// === server.js - NİHAİ v20 - Session Cookie Fix ===

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
// RENDER_EXTERNAL_URL ortam değişkeninin Render'da DOĞRU ayarlandığından emin ol!
// Bu, sitenin tam https://... adresini içermeli.
const allowedOrigins = process.env.RENDER_EXTERNAL_URL ? [process.env.RENDER_EXTERNAL_URL, 'http://localhost:3000'] : ['http://localhost:3000'];
console.log("İzin verilen Origin:", allowedOrigins);
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn("CORS engelledi:", origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true // Çerezlere izin ver
};
app.use(cors(corsOptions)); // Express için CORS

const io = new Server(server, {
    cors: corsOptions // Socket.IO için de AYNI CORS ayarlarını kullan
});

// Veritabanı Pool & Tablo Oluşturma (Aynı)
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
(async () => { /* ... içerik aynı ... */ })();

// Oturum Ayarları (Cookie ayarları güncellendi)
const sessionMiddleware = session({
    store: new pgSession({ pool : pool, tableName : 'user_sessions' }),
    secret: process.env.SESSION_SECRET,
    resave: false, saveUninitialized: false,
    cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 gün
        secure: true, // HER ZAMAN true yapalım (Render https kullanır, lokalde sorun olmaz)
        httpOnly: true,
        // Render üzerinde farklı origin'ler arası çerez için 'none' GEREKLİDİR.
        // Lokal test için 'lax' daha güvenlidir.
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    }
});
app.use(sessionMiddleware);
const wrap = middleware => (socket, next) => middleware(socket.request, {}, next);
io.use(wrap(sessionMiddleware));

// Socket.IO Bağlantı Koruması (Aynı loglar)
io.use((socket, next) => {
    const req = socket.request;
    console.log("--> io.use() Auth Check Başladı.");
    console.log("    -> İstek Çerezleri (Headers):", req.headers.cookie);
    if (!req.session) { console.error("--> io.use() Auth FAILED: No 'session' object!"); return next(new Error('Session not found')); }
    if (!req.session.user) { console.error("--> io.use() Auth FAILED: Session OK, but no 'user'!", req.session); return next(new Error('Auth required')); }
    console.log(`--> io.use() Auth OK: User=${req.session.user.username} (SessionID: ${req.session.id})`);
    next();
});

// Diğer Middleware'ler, Ayarlar, Rotalar, Socket.IO Olayları (Aynı)
app.use(express.json());
app.use(express.static('public'));
const storage = multer.memoryStorage();
const upload = multer({ storage: storage, /* ... */ }).single('image');
cloudinary.config({ /* ... */ });
let connectedUsers = {};
function getUsersInRoom(roomName) { /* ... */ }
function findSocketIdByUsername(username) { /* ... */ }
app.get('/', (req, res) => { /* ... */ });
app.post('/upload', (req, res) => { /* ... */ });
app.post('/register', async (req, res) => { /* ... */ });
app.post('/login', async (req, res) => { /* ... */ });
app.get('/check-auth', (req, res) => { /* ... */ });
app.post('/logout', (req, res) => { /* ... */ });
io.on('connection', (socket) => { /* ... Tüm olaylar aynı ... */ });

// Sunucuyu Başlat (Aynı)
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { console.log(`Sunucu ${PORT} portunda çalışıyor...`); });