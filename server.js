// === server.js - NİHAİ v21 - DB INIT KESİN DÜZELTME ===

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

// --- Tabloları oluştur/kontrol et (DOĞRU VE TAM SQL İLE - TEKRAR KONTROL EDİLDİ) ---
(async () => {
    let client; // Bağlantıyı scope dışına taşıyalım
    try {
        client = await pool.connect(); // Bağlantıyı al
        console.log('Neon (PostgreSQL) veritabanına başarıyla bağlanıldı.');

        // messages tablosu
        await client.query(`
          CREATE TABLE IF NOT EXISTS messages (
            id SERIAL PRIMARY KEY,
            room TEXT NOT NULL,
            username TEXT NOT NULL,
            message TEXT NOT NULL,
            timestamp TIMESTAMPTZ DEFAULT NOW(),
            user_id INTEGER NULL, -- FOREIGN KEY olabilir ama şimdilik null izinli
            is_deleted BOOLEAN DEFAULT FALSE,
            edited_at TIMESTAMPTZ DEFAULT NULL
          )`);
        console.log("'messages' tablosu OK.");

        // users tablosu
        await client.query(`
          CREATE TABLE IF NOT EXISTS users (
              id SERIAL PRIMARY KEY,
              username VARCHAR(50) UNIQUE NOT NULL,
              password_hash VARCHAR(60) NOT NULL,
              created_at TIMESTAMPTZ DEFAULT NOW()
          );`);
        console.log("'users' tablosu OK.");

         // user_sessions tablosu (Doğru ve tam SQL)
        await client.query(`
            CREATE TABLE IF NOT EXISTS "user_sessions" (
                "sid" varchar NOT NULL COLLATE "default",
                "sess" json NOT NULL,
                "expire" timestamp(6) NOT NULL
            ) WITH (OIDS=FALSE);`);
         // Primary key'i ayrı ekleyelim (varsa hata vermez)
         await client.query(`
            DO $$ BEGIN
                IF NOT EXISTS (SELECT constraint_name FROM information_schema.table_constraints WHERE table_name = 'user_sessions' AND constraint_type = 'PRIMARY KEY') THEN
                    ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;
                END IF;
            END $$;
         `);
        await client.query(`CREATE INDEX IF NOT EXISTS "IDX_user_sessions_expire" ON "user_sessions" ("expire");`);
         console.log("'user_sessions' tablosu OK.");

    } catch (err) {
        console.error('Veritabanı bağlantı veya tablo oluşturma hatası:', err);
        process.exit(1); // Kritik hata, durdur
    } finally {
         if (client) {
             client.release(); // Bağlantıyı havuza geri ver
             console.log("Veritabanı bağlantısı serbest bırakıldı.");
         }
    }
})();
// --- BİTTİ: Tablolar ---


// Oturum Ayarları
const sessionMiddleware = session({ store: new pgSession({ pool : pool, tableName : 'user_sessions' }), secret: process.env.SESSION_SECRET, resave: false, saveUninitialized: false, cookie: { maxAge: 30 * 24 * 60 * 60 * 1000, secure: process.env.NODE_ENV === 'production', httpOnly: true, sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax' } });
app.use(sessionMiddleware);
const wrap = middleware => (socket, next) => middleware(socket.request, {}, next);
io.use(wrap(sessionMiddleware));

// Diğer Middleware'ler
app.use(express.json());
app.use(express.static('public'));

// Multer Ayarları
const storage = multer.memoryStorage();
const upload = multer({ storage: storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (req, file, cb) => { const filetypes = /jpeg|jpg|png|gif/; const mimetype = filetypes.test(file.mimetype); const extname = filetypes.test(path.extname(file.originalname).toLowerCase()); if (mimetype && extname) return cb(null, true); cb(new Error("Hata: Sadece resim dosyaları!")); } }).single('image');

// Cloudinary Ayarları
cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET, secure: true });

// Anlık Hafıza & Helper Fonksiyonlar
let connectedUsers = {};
function getUsersInRoom(roomName) { /* ... */ }
function findSocketIdByUsername(username) { /* ... */ }

// --- Rotalar ---
app.get('/', (req, res) => { res.sendFile(__dirname + '/index.html'); });
app.post('/upload', (req, res) => { /* ... */ });
app.post('/register', async (req, res) => { /* ... */ });
app.post('/login', async (req, res) => { /* ... */ });
app.get('/check-auth', (req, res) => { /* ... */ });
app.post('/logout', (req, res) => { /* ... */ });

// --- Socket.IO ---
io.use((socket, next) => { /* ... Auth check ... */ });
io.on('connection', (socket) => { /* ... Tüm olaylar ... */ });

// --- Sunucuyu Başlat ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { console.log(`Sunucu ${PORT} portunda çalışıyor...`); }); // Bu log en SONDA görünmeli!