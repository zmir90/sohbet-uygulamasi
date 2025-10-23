// === SEVİYE 11.2 - GÜNCELLENMİŞ SERVER.JS (PostgreSQL) ===

// --- YENİ EKLENDİ: Gizli Bilgileri Yükle ---
// Bu satır EN ÜSTTE olmalı. Faz 11.1'de oluşturduğumuz '.env' dosyasını okur
// ve içindeki DATABASE_URL'i 'process.env' içine yükler.
require('dotenv').config();

// --- 1. Adım: Gerekli Kütüphaneler ---
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const multer = require('multer');
const path = require('path'); 
// --- YENİ EKLENDİ: PostgreSQL Kütüphanesi ---
const { Pool } = require('pg'); // 'sqlite3' kütüphanesini sildik

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- Statik Dosya Servisi (Değişiklik Yok) ---
app.use(express.static('public'));

// --- Multer (Dosya Yükleme) Ayarları (Değişiklik Yok) ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads/'),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ 
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

// --- Sunucunun "Anlık Hafızası" (Defter) (Değişiklik Yok) ---
let connectedUsers = {};

// --- YENİ: Sunucunun "Kalıcı Hafızası" (PostgreSQL Pool) ---
// 'sqlite3' bağlantısını sildik.
// Artık 'pg' Kütüphanesinin "Pool" (Bağlantı Havuzu) özelliğini kullanıyoruz.
// Bağlantı adresini (DATABASE_URL) '.env' dosyasından (process.env) okur.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Neon.tech için bu ayar gerekebilir
  }
});

// Veritabanına bağlanmayı dene ve tabloyu oluştur
(async () => {
  try {
    await pool.connect(); // Bağlantıyı test et
    console.log('Neon (PostgreSQL) veritabanına başarıyla bağlanıldı.');
    
    // YENİ: PostgreSQL uyumlu 'messages' tablosu oluşturma komutu
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        room TEXT NOT NULL,
        username TEXT NOT NULL,
        message TEXT NOT NULL,
        timestamp TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log("'messages' tablosu başarıyla oluşturuldu/bulundu (PostgreSQL).");
  } catch (err) {
    console.error('Veritabanı bağlantı veya tablo oluşturma hatası:', err);
  }
})();
// --- BİTTİ: Kalıcı Hafıza ---

// --- Yardımcı Fonksiyonlar (Değişiklik Yok) ---
function getUsersInRoom(roomName) {
  let users = [];
  for (const id in connectedUsers) {
    if (connectedUsers[id].room === roomName) users.push(connectedUsers[id].username);
  }
  return users;
}
function findSocketIdByUsername(username) {
  for (const id in connectedUsers) {
    if (connectedUsers[id].username === username) return id; 
  }
  return null; 
}

// --- 3. Adım: Ana Sayfa ve Yükleme Kapısı (Değişiklik Yok) ---
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});
app.post('/upload', (req, res) => {
  upload(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (req.file == undefined) {
      return res.status(400).json({ error: 'Dosya seçilmedi!' });
    }
    res.status(200).json({ imageUrl: `/uploads/${req.file.filename}` });
  });
});

// --- 4. Adım: Sohbet Sihirbazı (BÜYÜK GÜNCELLEME) ---
io.on('connection', (socket) => {
  
  // --- GÜNCELLENDİ: ODAYA KATILMA (PostgreSQL'den Geçmişi Yükle) ---
  socket.on('join chat', (data) => {
    const { username, room } = data; 
    socket.join(room); 
    socket.username = username;
    socket.room = room; 
    connectedUsers[socket.id] = { username, room };

    socket.emit('room joined', room);
    io.to(room).emit('update user list', getUsersInRoom(room));
    socket.broadcast.to(room).emit('user joined', username);

    // YENİ: MESAJ GEÇMİŞİNİ PostgreSQL'den YÜKLE
    (async () => {
      try {
        // YENİ SQL SÖZDİZİMİ: Soru işaretleri (?) yerine $1, $2 kullanılır.
        // Ve DESC yerine ASC yapıp yollamak daha kolaydır (zaten öyle yapıyormuşuz).
        const sql = `SELECT username, message, timestamp 
                     FROM messages 
                     WHERE room = $1 
                     ORDER BY timestamp ASC 
                     LIMIT 50`;
                     
        // YENİ SORGULAMA YÖNTEMİ: await pool.query(...)
        const history = await pool.query(sql, [room]);
        
        // YENİ SONUÇ YÖNTEMİ: Sonuçlar 'rows' (satırlar) içindedir.
        socket.emit('load history', history.rows);
        console.log(`'${room}' odası için ${history.rows.length} adet geçmiş mesaj yüklendi (PostgreSQL).`);
      } catch (err) {
        console.error('Mesaj geçmişi çekilirken hata (PostgreSQL):', err);
      }
    })();
  });

  // --- "Yazıyor..." Komutları (Değişiklik Yok) ---
  socket.on('typing', () => {
    socket.broadcast.to(socket.room).emit('user typing', socket.username);
  });
  socket.on('stop typing', () => {
    socket.broadcast.to(socket.room).emit('stop typing', socket.username);
  });

  // --- GÜNCELLENDİ: GENEL MESAJ GÖNDERME (PostgreSQL'e Kaydet) ---
  socket.on('chat message', (msg) => {
    if (!socket.username || !socket.room) return; 

    socket.broadcast.to(socket.room).emit('stop typing', socket.username);
    
    const messageData = { username: socket.username, message: msg };
    io.to(socket.room).emit('chat message', messageData);
    
    // YENİ: MESAJI VERİTABANINA KAYDET (PostgreSQL)
    const sql = `INSERT INTO messages (room, username, message) VALUES ($1, $2, $3)`;
    
    // YENİ SORGULAMA YÖNTEMİ: pool.query (callback ile)
    pool.query(sql, [socket.room, socket.username, msg], (err, res) => {
      if (err) {
        console.error('Mesaj veritabanına kaydedilirken hata (PostgreSQL):', err);
      } else {
        console.log(`Mesaj kaydedildi: [${socket.room}] ${socket.username}: ${msg} (PostgreSQL)`);
      }
    });
  });

  // --- Özel Mesaj Gönderme (Değişiklik Yok) ---
  socket.on('private message', (data) => {
    const { to, message } = data;
    const from = socket.username;
    const targetSocketId = findSocketIdByUsername(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit('private message', { from, message });
      socket.emit('private message', { to, message });
    } else {
      socket.emit('notification', { text: `Hata: '${to}' adlı kullanıcı bulunamadı.` });
    }
  });

  // --- Bağlantı Kesme (Değişiklik Yok) ---
  socket.on('disconnect', () => {
    const userData = connectedUsers[socket.id];
    if (userData) { 
      const { username, room } = userData; 
      delete connectedUsers[socket.id];
      io.to(room).emit('update user list', getUsersInRoom(room));
      socket.broadcast.to(room).emit('user left', username);
      socket.broadcast.to(room).emit('stop typing', username);
    }
  });
});

// --- 5. Adım: Dükkanı Açma (Değişiklik Yok) ---
// (Bu, Faz 10.1'de güncellediğimiz esnek port)
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Sunucu ${PORT} portunda çalışıyor...`);
});