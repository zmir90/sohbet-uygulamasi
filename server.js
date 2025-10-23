// === server.js - ÇİFT UPLOAD HATASI DÜZELTİLDİ ===

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

function logRequests(req, res, next) {
  console.log(`===> INCOMING REQUEST: ${req.method} ${req.originalUrl}`);
  next();
}

const app = express();
app.use(logRequests);
const server = http.createServer(app);
const io = new Server(server);

// Veritabanı Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Tabloları oluştur/kontrol et
(async () => {
    try {
        await pool.connect(); console.log('Neon (PostgreSQL) veritabanına başarıyla bağlanıldı.');
        await pool.query(`
          CREATE TABLE IF NOT EXISTS messages (
            id SERIAL PRIMARY KEY, room TEXT NOT NULL, username TEXT NOT NULL,
            message TEXT NOT NULL, timestamp TIMESTAMPTZ DEFAULT NOW(),
            user_id INTEGER, is_deleted BOOLEAN DEFAULT FALSE, edited_at TIMESTAMPTZ DEFAULT NULL
          )`);
        console.log("'messages' tablosu OK.");
        await pool.query(`
          CREATE TABLE IF NOT EXISTS users (
              id SERIAL PRIMARY KEY, username VARCHAR(50) UNIQUE NOT NULL,
              password_hash VARCHAR(60) NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
          );`);
        console.log("'users' tablosu OK.");
        console.log("'user_sessions' tablosu connect-pg-simple tarafından yönetilecek.");
    } catch (err) { console.error('DB Init Hata:', err); process.exit(1); }
})();

// Oturum Ayarları
const sessionMiddleware = session({
    store: new pgSession({ pool : pool, tableName : 'user_sessions' }),
    secret: process.env.SESSION_SECRET,
    resave: false, saveUninitialized: false,
    cookie: { maxAge: 30 * 24 * 60 * 60 * 1000, secure: process.env.NODE_ENV === 'production', httpOnly: true }
});
app.use(sessionMiddleware);
io.use((socket, next) => { sessionMiddleware(socket.request, {}, next); });

// Diğer Middleware'ler
app.use(express.json());
app.use(express.static('public'));

// --- Multer Ayarları (TEK VE DOĞRU TANIM) ---
const storage = multer.memoryStorage();
const upload = multer({ // <-- SADECE BURADA TANIMLANIYOR
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB Limit
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|gif/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        if (mimetype && extname) return cb(null, true);
        cb(new Error("Hata: Sadece resim dosyaları yüklenebilir!"));
    }
}).single('image');

// --- Cloudinary Ayarları ---
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET, secure: true
});

// Anlık Hafıza ve Yardımcı Fonksiyonlar
let connectedUsers = {};
function getUsersInRoom(roomName) { let users = []; for (const id in connectedUsers) { if (connectedUsers[id].room === roomName) users.push(connectedUsers[id].username); } return users; }
function findSocketIdByUsername(username) { for (const id in connectedUsers) { if (connectedUsers[id].username === username) return id; } return null; }

// --- Rotalar ---
app.get('/', (req, res) => { res.sendFile(__dirname + '/index.html'); });
app.post('/upload', (req, res) => {
    upload(req, res, (err) => { // <-- Burada sadece KULLANILIYOR
        if (err) return res.status(400).json({ error: err.message });
        if (!req.file) return res.status(400).json({ error: 'Dosya seçilmedi!' });
        let uploadFromBuffer = (buffer) => new Promise((resolve, reject) => { cloudinary.uploader.upload_stream({}, (error, result) => result ? resolve(result) : reject(error)).end(buffer); });
        uploadFromBuffer(req.file.buffer)
            .then(result => res.status(200).json({ imageUrl: result.secure_url }))
            .catch(error => { console.error('Cloudinary yükleme hatası:', error); res.status(500).json({ error: 'Resim yüklenemedi.' }); });
    });
});
// --- Kimlik Doğrulama Kapıları ---
app.post('/register', async (req, res) => {
    console.log("-> /register isteği alındı");
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Kullanıcı adı ve şifre gerekli.' });
    try {
        const existingUser = await pool.query('SELECT 1 FROM users WHERE username = $1', [username]);
        if (existingUser.rows.length > 0) return res.status(409).json({ error: 'Kullanıcı adı alınmış.' });
        const passwordHash = await bcrypt.hash(password, saltRounds);
        await pool.query('INSERT INTO users (username, password_hash) VALUES ($1, $2)', [username, passwordHash]);
        console.log(`-> Kullanıcı kaydedildi: ${username}`);
        res.status(201).json({ message: 'Kayıt başarılı.' });
    } catch (err) { console.error('Kayıt hatası:', err); res.status(500).json({ error: 'Sunucu hatası.' }); }
});
app.post('/login', async (req, res) => {
    console.log("-> /login isteği alındı");
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Kullanıcı adı ve şifre gerekli.' });
    try {
        const result = await pool.query('SELECT id, username, password_hash FROM users WHERE username = $1', [username]);
        const user = result.rows[0];
        if (!user) return res.status(401).json({ error: 'Kullanıcı bulunamadı.' });
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) return res.status(401).json({ error: 'Yanlış şifre.' });
        req.session.user = { id: user.id, username: user.username };
        console.log(`-> Giriş başarılı: ${username}`);
        res.status(200).json({ message: 'Giriş başarılı.', user: req.session.user });
    } catch (err) { console.error('Giriş hatası:', err); res.status(500).json({ error: 'Sunucu hatası.' }); }
});
app.get('/check-auth', (req, res) => { if (req.session.user) res.status(200).json({ loggedIn: true, user: req.session.user }); else res.status(200).json({ loggedIn: false }); });
app.post('/logout', (req, res) => { const username = req.session.user?.username || '?'; req.session.destroy((err) => { if (err) { console.error(`Çıkış hatası (${username}):`, err); return res.status(500).json({ error: 'Çıkış yapılamadı.' }); } res.clearCookie('connect.sid'); console.log(`-> Oturum sonlandırıldı: ${username}`); res.status(200).json({ message: 'Çıkış başarılı.' }); }); });

// --- Socket.IO ---
io.use((socket, next) => { if (socket.request.session.user) next(); else next(new Error('Auth required')); });
io.on('connection', (socket) => {
    const sessionUser = socket.request.session.user; if (!sessionUser) { socket.disconnect(true); return; }
    const currentUserId = sessionUser.id; const currentUsername = sessionUser.username;
    console.log(`Socket connected: ${currentUsername} (${socket.id})`);

    socket.on('join chat', (data) => {
        const { room } = data; if (!room) return;
        if (socket.room) { socket.leave(socket.room); }
        socket.join(room); socket.room = room;
        connectedUsers[socket.id] = { username: currentUsername, room };
        console.log(`${currentUsername} odaya katıldı: ${room}`);
        socket.emit('room joined', room);
        io.to(room).emit('update user list', getUsersInRoom(room));
        socket.broadcast.to(room).emit('user joined', currentUsername);
        (async () => {
            try {
                const sql = `SELECT id, user_id, username, message, timestamp, is_deleted, edited_at FROM messages WHERE room = $1 ORDER BY timestamp ASC LIMIT 50`;
                const history = await pool.query(sql, [room]);
                socket.emit('load history', history.rows);
            } catch (err) { console.error('Mesaj geçmişi çekilirken hata (PostgreSQL):', err); }
        })();
    });
    socket.on('typing', () => { socket.broadcast.to(socket.room).emit('user typing', currentUsername); });
    socket.on('stop typing', () => { socket.broadcast.to(socket.room).emit('stop typing', currentUsername); });
    socket.on('chat message', (msg) => {
        const room = socket.room; if (!currentUsername || !room) return;
        socket.broadcast.to(room).emit('stop typing', currentUsername);
        const messageData = { username: currentUsername, message: msg };
        io.to(room).emit('chat message', messageData);
        const sql = `INSERT INTO messages (room, username, message, user_id) VALUES ($1, $2, $3, $4)`;
        pool.query(sql, [room, currentUsername, msg, currentUserId], (err, res) => { if (err) console.error('Mesaj kaydedilirken hata (PostgreSQL):', err); });
    });
    socket.on('delete message', async (messageId) => {
        const room = socket.room; if (!currentUsername || !room || !messageId) return;
        try {
            const result = await pool.query('SELECT user_id FROM messages WHERE id = $1 AND room = $2', [messageId, room]);
            const messageOwnerId = result.rows[0]?.user_id;
            if (messageOwnerId && messageOwnerId === currentUserId) {
                await pool.query('UPDATE messages SET is_deleted = TRUE, message = \'[Mesaj silindi]\' WHERE id = $1', [messageId]);
                io.to(room).emit('message deleted', { messageId: messageId });
                console.log(`${currentUsername} mesajı sildi (ID: ${messageId})`);
            } else { socket.emit('notification', { text: 'Hata: Bu mesajı silemezsiniz.' }); console.warn(`${currentUsername} yetkisiz silme denemesi yaptı (ID: ${messageId})`); }
        } catch (err) { console.error(`Mesaj silinirken hata (ID: ${messageId}):`, err); socket.emit('notification', { text: 'Mesaj silinirken bir hata oluştu.' }); }
    });
    socket.on('edit message', async (data) => {
        const { messageId, newMessage } = data; const room = socket.room;
        if (!currentUsername || !room || !messageId || newMessage === undefined) return;
        try {
            const result = await pool.query('SELECT user_id FROM messages WHERE id = $1 AND room = $2 AND is_deleted = FALSE', [messageId, room]);
            const messageOwnerId = result.rows[0]?.user_id;
            if (messageOwnerId && messageOwnerId === currentUserId) {
                const now = new Date();
                await pool.query('UPDATE messages SET message = $1, edited_at = $2 WHERE id = $3', [newMessage, now, messageId]);
                io.to(room).emit('message edited', { messageId: messageId, newMessage: newMessage, editedAt: now });
                console.log(`${currentUsername} mesajı düzenledi (ID: ${messageId})`);
            } else { socket.emit('notification', { text: 'Hata: Bu mesajı düzenleyemezsiniz.' }); console.warn(`${currentUsername} yetkisiz düzenleme denemesi yaptı (ID: ${messageId})`); }
        } catch (err) { console.error(`Mesaj düzenlenirken hata (ID: ${messageId}):`, err); socket.emit('notification', { text: 'Mesaj düzenlenirken bir hata oluştu.' }); }
    });
    socket.on('private message', (data) => { const from = currentUsername; const { to, message } = data; const targetSocketId = findSocketIdByUsername(to); if (targetSocketId) { io.to(targetSocketId).emit('private message', { from, message }); socket.emit('private message', { to, message }); } else { socket.emit('notification', { text: `Hata: '${to}' adlı kullanıcı bulunamadı.` }); } });
    socket.on('disconnect', () => { const userData = connectedUsers[socket.id]; let usernameToNotify = currentUsername; let roomToNotify = socket.room; if (userData) { usernameToNotify = userData.username; roomToNotify = userData.room; delete connectedUsers[socket.id]; console.log(`${usernameToNotify} (${socket.id}) odadan ayrıldı: ${roomToNotify}`); if (roomToNotify) { io.to(roomToNotify).emit('update user list', getUsersInRoom(roomToNotify)); socket.broadcast.to(roomToNotify).emit('user left', usernameToNotify); socket.broadcast.to(roomToNotify).emit('stop typing', usernameToNotify); } } else { console.log(`${usernameToNotify} (oturumdan) bağlantısı kesildi, odası bilinmiyor.`); } });
});

// --- Sunucuyu Başlat ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { console.log(`Sunucu ${PORT} portunda çalışıyor...`); });