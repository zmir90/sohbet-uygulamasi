// === SEVİYE 13.4 - DÜZELTİLMİŞ SERVER.JS (Log Eklendi) ===

// Gizli Bilgileri Yükle (.env)
require('dotenv').config();

// --- 1. Adım: Gerekli Kütüphaneler ---
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

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- Veritabanı Pool ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Tabloları oluştur
(async () => {
    try {
        await pool.connect();
        console.log('Neon (PostgreSQL) veritabanına başarıyla bağlanıldı.');
        await pool.query(`
          CREATE TABLE IF NOT EXISTS messages (
            id SERIAL PRIMARY KEY, room TEXT NOT NULL, username TEXT NOT NULL,
            message TEXT NOT NULL, timestamp TIMESTAMPTZ DEFAULT NOW()
          )`);
        console.log("'messages' tablosu başarıyla oluşturuldu/bulundu.");
        await pool.query(`
          CREATE TABLE IF NOT EXISTS users (
              id SERIAL PRIMARY KEY, username VARCHAR(50) UNIQUE NOT NULL,
              password_hash VARCHAR(60) NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
          );`);
        console.log("'users' tablosu başarıyla oluşturuldu/bulundu.");
         // user_sessions tablosu Neon'da manuel oluşturuldu
    } catch (err) {
        console.error('Veritabanı bağlantı veya tablo oluşturma hatası:', err);
    }
})();

// --- Oturum Ayarları ---
const sessionMiddleware = session({
    store: new pgSession({ pool : pool, tableName : 'user_sessions' }),
    secret: process.env.SESSION_SECRET,
    resave: false, saveUninitialized: false,
    cookie: { maxAge: 30 * 24 * 60 * 60 * 1000, secure: process.env.NODE_ENV === 'production', httpOnly: true }
});
app.use(sessionMiddleware);
io.use((socket, next) => { sessionMiddleware(socket.request, {}, next); });

// Express'in JSON Okumasını Sağla
app.use(express.json());

// Statik Dosya Servisi
app.use(express.static('public'));

// --- Multer Ayarları ---
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage, limits: { fileSize: 5 * 1024 * 1024 },
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

// --- Anlık Hafıza ---
let connectedUsers = {};

// --- Yardımcı Fonksiyonlar ---
function getUsersInRoom(roomName) {
    let users = [];
    for (const id in connectedUsers) { if (connectedUsers[id].room === roomName) users.push(connectedUsers[id].username); }
    return users;
}
function findSocketIdByUsername(username) {
    for (const id in connectedUsers) { if (connectedUsers[id].username === username) return id; }
    return null;
}

// --- 3. Adım: Rotalar (HTTP Kapıları) ---

// Ana Sayfa
app.get('/', (req, res) => { res.sendFile(__dirname + '/index.html'); });

// Resim Yükleme
app.post('/upload', (req, res) => {
    upload(req, res, (err) => {
        if (err) return res.status(400).json({ error: err.message });
        if (!req.file) return res.status(400).json({ error: 'Dosya seçilmedi!' });
        let uploadFromBuffer = (buffer) => {
             return new Promise((resolve, reject) => {
                let cld_upload_stream = cloudinary.uploader.upload_stream({}, (error, result) => {
                    if (result) resolve(result); else reject(error);
                });
                streamifier.createReadStream(buffer).pipe(cld_upload_stream);
            });
        };
        uploadFromBuffer(req.file.buffer)
            .then(result => res.status(200).json({ imageUrl: result.secure_url }))
            .catch(error => {
                console.error('Cloudinary yükleme hatası (route):', error); // Detaylı log
                res.status(500).json({ error: 'Resim Cloudinary\'ye yüklenemedi.' });
            });
    });
});

// --- Kimlik Doğrulama Kapıları ---

// Kayıt
app.post('/register', async (req, res) => {
    console.log("==> /register isteği alındı:", req.body); // <-- LOG EKLENDİ
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Kullanıcı adı ve şifre gereklidir.' });
    try {
        console.log("    -> Try bloğuna girildi (register)"); // <-- LOG EKLENDİ
        const existingUser = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (existingUser.rows.length > 0) return res.status(409).json({ error: 'Bu kullanıcı adı zaten alınmış.' });
        const passwordHash = await bcrypt.hash(password, saltRounds);
        await pool.query('INSERT INTO users (username, password_hash) VALUES ($1, $2)', [username, passwordHash]);
        console.log(`    -> Kullanıcı kaydedildi: ${username}`); // <-- BAŞARI LOGU EKLENDİ
        res.status(201).json({ message: 'Kullanıcı başarıyla kaydedildi.' });
    } catch (err) {
        console.error('Kayıt hatası (catch bloğu):', err); // Mevcut log
        res.status(500).json({ error: 'Kayıt sırasında bir hata oluştu.' });
    }
});

// Giriş
app.post('/login', async (req, res) => {
    console.log("==> /login isteği alındı:", req.body); // <-- LOG EKLENDİ
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Kullanıcı adı ve şifre gereklidir.' });
    try {
        console.log("    -> Try bloğuna girildi (login)"); // <-- LOG EKLENDİ
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];
        if (!user) {
            console.log(`    -> Giriş denemesi BAŞARISIZ: Kullanıcı bulunamadı (${username})`); // <-- HATA LOGU EKLENDİ
            return res.status(401).json({ error: 'Kullanıcı bulunamadı.' });
        }
        console.log(`    -> Kullanıcı bulundu: ${username}`); // <-- BİLGİ LOGU EKLENDİ
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            console.log(`    -> Giriş denemesi BAŞARISIZ: Yanlış şifre (${username})`); // <-- HATA LOGU EKLENDİ
            return res.status(401).json({ error: 'Yanlış şifre.' });
        }
        req.session.user = { id: user.id, username: user.username };
        console.log(`    -> Giriş BAŞARILI: Oturum oluşturuldu (${username})`); // <-- BAŞARI LOGU EKLENDİ
        res.status(200).json({ message: 'Giriş başarılı.', user: req.session.user });
    } catch (err) {
        console.error('Giriş hatası (catch bloğu):', err); // Mevcut log
        res.status(500).json({ error: 'Giriş sırasında bir hata oluştu.' });
    }
});

// Oturum Kontrol
app.get('/check-auth', (req, res) => {
    if (req.session.user) res.status(200).json({ loggedIn: true, user: req.session.user });
    else res.status(200).json({ loggedIn: false });
});

// Çıkış
app.post('/logout', (req, res) => {
    const username = req.session.user?.username || 'Bilinmeyen kullanıcı';
    req.session.destroy((err) => {
        if (err) {
            console.error(`Çıkış hatası (${username}):`, err); // <-- HATA LOGU EKLENDİ
            return res.status(500).json({ error: 'Çıkış yapılamadı.' });
        }
        res.clearCookie('connect.sid');
        console.log(`Oturum sonlandırıldı: ${username}`); // <-- BİLGİ LOGU EKLENDİ
        res.status(200).json({ message: 'Çıkış başarılı.' });
    });
});


// --- 4. Adım: Sohbet Sihirbazı (Socket.io - %100 GÜVENLİ) ---
io.use((socket, next) => {
    if (socket.request.session.user) next();
    else next(new Error('Kimlik doğrulaması gerekiyor.'));
});

io.on('connection', (socket) => {
    const sessionUser = socket.request.session.user;
    if (!sessionUser) { socket.disconnect(true); return; }
    const currentUsername = sessionUser.username;
    console.log(`${currentUsername} (${socket.id}) bağlandı.`);

    // Odaya Katılma
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
                const sql = `SELECT username, message, timestamp FROM messages WHERE room = $1 ORDER BY timestamp ASC LIMIT 50`;
                const history = await pool.query(sql, [room]);
                socket.emit('load history', history.rows);
            } catch (err) { console.error('Mesaj geçmişi çekilirken hata (PostgreSQL):', err); }
        })();
    });

    // Yazıyor...
    socket.on('typing', () => { socket.broadcast.to(socket.room).emit('user typing', currentUsername); });
    socket.on('stop typing', () => { socket.broadcast.to(socket.room).emit('stop typing', currentUsername); });

    // Genel Mesaj
    socket.on('chat message', (msg) => {
        const room = socket.room; if (!currentUsername || !room) return;
        socket.broadcast.to(room).emit('stop typing', currentUsername);
        const messageData = { username: currentUsername, message: msg };
        io.to(room).emit('chat message', messageData);
        const sql = `INSERT INTO messages (room, username, message) VALUES ($1, $2, $3)`;
        pool.query(sql, [room, currentUsername, msg], (err, res) => { if (err) console.error('Mesaj kaydedilirken hata (PostgreSQL):', err); });
    });

    // Özel Mesaj
    socket.on('private message', (data) => {
        const from = currentUsername; const { to, message } = data;
        const targetSocketId = findSocketIdByUsername(to);
        if (targetSocketId) { io.to(targetSocketId).emit('private message', { from, message }); socket.emit('private message', { to, message }); }
        else { socket.emit('notification', { text: `Hata: '${to}' adlı kullanıcı bulunamadı.` }); }
    });

    // Bağlantı Kesme
    socket.on('disconnect', () => {
        const userData = connectedUsers[socket.id];
        let usernameToNotify = currentUsername; let roomToNotify = socket.room;
        if (userData) {
            usernameToNotify = userData.username; roomToNotify = userData.room;
            delete connectedUsers[socket.id]; console.log(`${usernameToNotify} (${socket.id}) odadan ayrıldı: ${roomToNotify}`);
            if (roomToNotify) {
                 io.to(roomToNotify).emit('update user list', getUsersInRoom(roomToNotify));
                 socket.broadcast.to(roomToNotify).emit('user left', usernameToNotify);
                 socket.broadcast.to(roomToNotify).emit('stop typing', usernameToNotify);
            }
        } else { console.log(`${usernameToNotify} (oturumdan) bağlantısı kesildi, odası bilinmiyor.`); }
    });
});


// --- 5. Adım: Dükkanı Açma ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Sunucu ${PORT} portunda çalışıyor...`);
});