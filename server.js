// === server.js - NİHAİ v24 - KESİN SON STABİL ===

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

function logRequests(req, res, next) {
  // Sadece ana istekleri loglayalım, statik dosyaları değil
  if (!req.originalUrl.startsWith('/style.css') && !req.originalUrl.startsWith('/client.js') && !req.originalUrl.startsWith('/socket.io')) {
    console.log(`=> REQ: ${req.method} ${req.originalUrl}`);
  }
  next();
}

const app = express();
app.use(logRequests);
const server = http.createServer(app);

// --- CORS Ayarları (Render için optimize edildi) ---
const allowedOrigins = process.env.RENDER_EXTERNAL_URL ? [process.env.RENDER_EXTERNAL_URL] : ['http://localhost:3000'];
console.log("İzin verilen Origin:", allowedOrigins);
const corsOptions = {
  origin: function (origin, callback) {
    // Aynı origin (tarayıcıdan gelen origin yoksa) veya izin verilenler listesindeyse izin ver
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn("CORS ENGELLEDİ:", origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true // Çerezlerin gönderilip alınmasına izin ver
};
app.use(cors(corsOptions)); // Express için CORS

const io = new Server(server, {
    cors: corsOptions // Socket.IO için de AYNI CORS ayarlarını kullan
});

// Veritabanı Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Render'ın PostgreSQL'i için SSL genellikle gereklidir
  ssl: { rejectUnauthorized: false }
});

// Tabloları oluştur/kontrol et
(async () => {
    let client;
    try {
        client = await pool.connect(); console.log('DB Connected.');
        // messages
        await client.query(`CREATE TABLE IF NOT EXISTS messages (id SERIAL PRIMARY KEY, room TEXT NOT NULL, username TEXT NOT NULL, message TEXT NOT NULL, timestamp TIMESTAMPTZ DEFAULT NOW(), user_id INTEGER NULL, is_deleted BOOLEAN DEFAULT FALSE, edited_at TIMESTAMPTZ DEFAULT NULL)`); console.log("'messages' OK.");
        // users
        await client.query(`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, username VARCHAR(50) UNIQUE NOT NULL, password_hash VARCHAR(60) NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW());`); console.log("'users' OK.");
        // user_sessions
        await client.query(`CREATE TABLE IF NOT EXISTS "user_sessions" ("sid" varchar NOT NULL COLLATE "default","sess" json NOT NULL,"expire" timestamp(6) NOT NULL) WITH (OIDS=FALSE); DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'user_sessions'::regclass AND conname = 'user_sessions_pkey') THEN ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("sid"); END IF; END $$; CREATE INDEX IF NOT EXISTS "IDX_user_sessions_expire" ON "user_sessions" ("expire");`); console.log("'user_sessions' OK.");
    } catch (err) { console.error('DB Init Hata:', err); process.exit(1); }
    finally { if (client) { client.release(); console.log("DB connection released."); } }
})();

// Oturum Ayarları (Render için optimize edildi)
const sessionMiddleware = session({
    store: new pgSession({ pool : pool, tableName : 'user_sessions' }),
    secret: process.env.SESSION_SECRET, // BU DEĞİŞKENİN Render'da AYARLI OLMASI ŞART!
    resave: false,
    saveUninitialized: false, // Sadece giriş yapınca session oluştur
    cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 gün
        secure: process.env.NODE_ENV === 'production', // Render'da true olacak (HTTPS)
        httpOnly: true, // JS'den erişilemez
        // Render üzerinde farklı origin (HTTPS vs WSS) çerez paylaşımı için 'none' GEREKLİ
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    }
});
app.use(sessionMiddleware); // Önce Express session'ı kullan
// Socket.IO'nun Express session'ını kullanmasını sağla
const wrap = middleware => (socket, next) => middleware(socket.request, {}, next);
io.use(wrap(sessionMiddleware));

// Socket.IO Bağlantı Koruması (Session kontrolü)
io.use((socket, next) => {
    const session = socket.request.session;
    if (session && session.user) {
        console.log(`--> Socket Auth OK: ${session.user.username}`);
        socket.user = session.user; // Kullanıcıyı sokete ekle
        next();
    } else {
        console.error("--> Socket Auth FAILED: Session veya User bulunamadı!");
        next(new Error('Authentication failed')); // Bağlantıyı reddet
    }
});

// Diğer Middleware'ler
app.use(express.json());
app.use(express.static('public')); // Statik dosyalar session'dan SONRA

// Multer & Cloudinary Ayarları
const storage = multer.memoryStorage();
const upload = multer({ storage: storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (req, file, cb)=>{/*...*/}}).single('image');
cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET, secure: true });

// Anlık Hafıza & Helper Fonksiyonlar
let connectedUsers = {};
function getUsersInRoom(roomName) { let users = []; for (const id in connectedUsers) { if (connectedUsers[id].room === roomName) users.push(connectedUsers[id].username); } return users; }
function findSocketIdByUsername(username) { for (const id in connectedUsers) { if (connectedUsers[id].username === username) return id; } return null; }

// --- Rotalar ---
app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'index.html')); }); // path.join daha güvenli
app.post('/upload', (req, res) => { upload(req, res, (err) => { /* ... (hata kontrolü, cloudinary'ye yükleme) ... */ }); });
app.post('/register', async (req, res) => { /* ... (veritabanı kontrolü, hash'leme, insert) ... */ });
app.post('/login', async (req, res) => {
    console.log("-> /login isteği"); const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Eksik bilgi.' });
    try {
        const result = await pool.query('SELECT id, username, password_hash FROM users WHERE username = $1', [username]);
        const user = result.rows[0];
        if (!user) return res.status(401).json({ error: 'Kullanıcı bulunamadı.' });
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) return res.status(401).json({ error: 'Yanlış şifre.' });
        // ÖNEMLİ: Session'ı DEĞİŞTİRDİKTEN sonra save() çağırılmalı
        req.session.user = { id: user.id, username: user.username };
        req.session.save((err) => { // Kaydetmeyi bekle
             if (err) { console.error('Login session save error:', err); return res.status(500).json({ error: 'Oturum hatası.' }); }
             console.log(`-> Giriş başarılı: ${username}`);
             // Token'a artık GEREK YOK, session kullanılacak
             res.status(200).json({ message: 'Giriş başarılı.', user: req.session.user });
        });
    } catch (err) { console.error('Giriş hatası:', err); res.status(500).json({ error: 'Sunucu hatası.' }); }
});
app.get('/check-auth', (req, res) => { // Token'a GEREK YOK
    if (req.session.user) res.status(200).json({ loggedIn: true, user: req.session.user });
    else res.status(200).json({ loggedIn: false });
});
app.post('/logout', (req, res) => { /* ... (session destroy) ... */ });

// --- Socket.IO Olayları ---
io.on('connection', (socket) => {
    // Kullanıcı bilgisi artık io.use içinde socket.user'a eklendi
    const currentUser = socket.user;
    if (!currentUser) { socket.disconnect(true); return; } // Ekstra kontrol
    const currentUserId = currentUser.id;
    const currentUsername = currentUser.username;
    console.log(`✅ Socket CONNECTED: ${currentUsername} (${socket.id})`);

    socket.on('join chat', (data) => { /* ... (currentUsername ve currentUserId kullanılacak) ... */ });
    socket.on('typing', () => { /* ... (currentUsername kullanılacak) ... */ });
    socket.on('stop typing', () => { /* ... (currentUsername kullanılacak) ... */ });
    socket.on('chat message', (msg) => { /* ... (currentUsername ve currentUserId kullanılacak) ... */ });
    socket.on('delete message', async (messageId) => { /* ... (currentUserId ile yetki kontrolü) ... */ });
    socket.on('edit message', async (data) => { /* ... (currentUserId ile yetki kontrolü) ... */ });
    socket.on('private message', (data) => { /* ... (currentUsername kullanılacak) ... */ });
    socket.on('disconnect', (reason) => { /* ... (currentUsername veya connectedUsers'dan isim alınacak) ... */ });
});

// --- Sunucuyu Başlat ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { console.log(`Sunucu ${PORT} portunda çalışıyor...`); });