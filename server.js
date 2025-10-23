// === server.js - NİHAİ v16 - SQL HATASI KESİN DÜZELTİLDİ ===

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
const cors = require('cors'); // CORS eklendi

function logRequests(req, res, next) {
  console.log(`=> REQ: ${req.method} ${req.originalUrl}`);
  next();
}

const app = express();
app.use(logRequests);
const server = http.createServer(app);

// CORS Ayarları
const allowedOrigins = [process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000'];
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
  credentials: true
};
app.use(cors(corsOptions));

const io = new Server(server, { cors: corsOptions });

// Veritabanı Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// --- Tabloları oluştur/kontrol et (DOĞRU VE TAM SQL) ---
(async () => {
    try {
        await pool.connect();
        console.log('Neon (PostgreSQL) veritabanına başarıyla bağlanıldı.');
        // messages tablosu
        await pool.query(`
          CREATE TABLE IF NOT EXISTS messages (
            id SERIAL PRIMARY KEY,
            room TEXT NOT NULL,
            username TEXT NOT NULL,
            message TEXT NOT NULL,
            timestamp TIMESTAMPTZ DEFAULT NOW(),
            user_id INTEGER,
            is_deleted BOOLEAN DEFAULT FALSE,
            edited_at TIMESTAMPTZ DEFAULT NULL
          )`);
        console.log("'messages' tablosu OK.");
        // users tablosu
        await pool.query(`
          CREATE TABLE IF NOT EXISTS users (
              id SERIAL PRIMARY KEY,
              username VARCHAR(50) UNIQUE NOT NULL,
              password_hash VARCHAR(60) NOT NULL,
              created_at TIMESTAMPTZ DEFAULT NOW()
          );`);
        console.log("'users' tablosu OK.");
         // user_sessions tablosu (Doğru ve tam SQL)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS "user_sessions" (
                "sid" varchar NOT NULL COLLATE "default",
                "sess" json NOT NULL,
                "expire" timestamp(6) NOT NULL
            ) WITH (OIDS=FALSE);`);
         // Primary key'i ayrı ekleyelim (varsa hata vermez)
         await pool.query(`
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_sessions_pkey') THEN
                    ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;
                END IF;
            END $$;
         `);
        await pool.query(`CREATE INDEX IF NOT EXISTS "IDX_user_sessions_expire" ON "user_sessions" ("expire");`);
         console.log("'user_sessions' tablosu OK.");
    } catch (err) {
        console.error('DB Init Hata:', err); // Daha detaylı loglama için hatayı yazdır
        process.exit(1); // Kritik hata, durdur
    }
})();
// --- BİTTİ: Tablolar ---


// Oturum Ayarları
const sessionMiddleware = session({
    store: new pgSession({ pool : pool, tableName : 'user_sessions' }),
    secret: process.env.SESSION_SECRET,
    resave: false, saveUninitialized: false,
    cookie: { maxAge: 30 * 24 * 60 * 60 * 1000, secure: process.env.NODE_ENV === 'production', httpOnly: true, sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax' }
});
app.use(sessionMiddleware);
const wrap = middleware => (socket, next) => middleware(socket.request, {}, next);
io.use(wrap(sessionMiddleware));

// Diğer Middleware'ler
app.use(express.json());
app.use(express.static('public'));

// Multer Ayarları
const storage = multer.memoryStorage();
const upload = multer({ storage: storage, /* ... Kalan ayarlar aynı ... */ }).single('image');

// Cloudinary Ayarları
cloudinary.config({ /* ... ayarlar aynı ... */ });

// Anlık Hafıza & Helper Fonksiyonlar
let connectedUsers = {};
function getUsersInRoom(roomName) { /* ... */ }
function findSocketIdByUsername(username) { /* ... */ }

// --- Rotalar ---
app.get('/', (req, res) => { res.sendFile(__dirname + '/index.html'); });
app.post('/upload', (req, res) => { /* ... içerik aynı ... */ });
app.post('/register', async (req, res) => { /* ... içerik aynı ... */ });
app.post('/login', async (req, res) => { /* ... içerik aynı ... */ });
app.get('/check-auth', (req, res) => { /* ... içerik aynı ... */ });
app.post('/logout', (req, res) => { /* ... içerik aynı ... */ });

// --- Socket.IO ---
io.use((socket, next) => { /* ... Auth check logları ... */ });
io.on('connection', (socket) => { /* ... Tüm socket olayları aynı ... */ });

// --- Sunucuyu Başlat ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { console.log(`Sunucu ${PORT} portunda çalışıyor...`); });