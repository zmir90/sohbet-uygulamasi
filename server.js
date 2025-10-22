// === SEVİYE 9.3 - GÜNCELLENMİŞ SERVER.JS ===

// --- 1. Adım: Gerekli Kütüphaneler ---
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const sqlite3 = require('sqlite3').verbose(); 
// --- YENİ EKLENDİ: Dosya Yükleme Yardımcısı ---
const multer = require('multer');
// --- YENİ EKLENDİ: Dosya Yolu Yardımcısı ---
// (Dosya isimlerini ve yollarını güvenli bir şekilde birleştirmek için)
const path = require('path'); 

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- Statik Dosya Servisi (Değişiklik Yok) ---
// 'public' klasörünü dünyaya açar. '/uploads' klasörü de 'public' içinde
// olduğu için, buraya yüklenen resimlere /uploads/resim.png olarak erişilebilir.
app.use(express.static('public'));

// --- YENİ EKLENDİ: MULTER (DOSYA YÜKLEME) AYARLARI ---

// 1. Resimleri Nereye Kaydedeceğimizi Belirle
const storage = multer.diskStorage({
  // Hedef klasör: 'public/uploads' klasörü
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/');
  },
  // Dosya Adı: Benzersiz bir isim oluştur
  // (Orijinal isim + O anın milisaniye değeri + Orijinal uzantı)
  // örn: kedi.png -> kedi-1678886598512.png
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// 2. 'Multer' yardımcısını bu ayarlarla yapılandır
//    'upload.single('image')' -> "Sadece 1 dosya al, ve o dosyanın adı 'image' olacak"
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Limit: 5 Megabyte
  fileFilter: (req, file, cb) => {
    // Sadece resim dosyalarına izin ver (jpeg, png, gif)
    const filetypes = /jpeg|jpg|png|gif/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error("Hata: Sadece resim dosyaları yüklenebilir (jpeg, png, gif)!"));
  }
}).single('image'); // 'image', client.js'ten göndereceğimiz dosyanın "alan adı"

// --- BİTTİ: MULTER AYARLARI ---


// --- Sunucunun "Anlık Hafızası" (Defter) ---
let connectedUsers = {};

// --- Sunucunun "Kalıcı Hafızası" (Veritabanı) ---
const db = new sqlite3.Database('./database.db', (err) => {
  if (err) console.error('Veritabanı bağlantı hatası:', err.message);
  else console.log('Veritabanına (database.db) başarıyla bağlanıldı.');
});
// Tabloyu oluştur (Değişiklik yok)
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS messages (...)`, (err) => { /* ...içerik aynı... */ });
});
// (Yukarıdaki CREATE TABLE kodunu kısa tuttum, sizde tamamı olmalı)
// Tam CREATE TABLE kodu:
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room TEXT NOT NULL,
    username TEXT NOT NULL,
    message TEXT NOT NULL,
    timestamp DATETIME DEFAULT (datetime('now','localtime'))
  )`, (err) => {
    if (err) console.error('Tablo oluşturulurken hata:', err.message);
  });
});


// --- Yardımcı Fonksiyonlar (Değişiklik Yok) ---
function getUsersInRoom(roomName) { /* ...içerik aynı... */ return []; }
function findSocketIdByUsername(username) { /* ...içerik aynı... */ return null; }
// Gerçek fonksiyonlar (kısa versiyonları değil)
function getUsersInRoom(roomName) {
  let users = [];
  for (const id in connectedUsers) {
    if (connectedUsers[id].room === roomName) {
      users.push(connectedUsers[id].username);
    }
  }
  return users;
}
function findSocketIdByUsername(username) {
  for (const id in connectedUsers) {
    if (connectedUsers[id].username === username) return id; 
  }
  return null; 
}


// --- 3. Adım: Ana Sayfayı Sunma (Değişiklik Yok) ---
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});


// --- YENİ EKLENDİ: HTTP KAPISI (ENDPOINT) ---
// YENİ "Resim Kabul Kapısı"
// 'client.js' (sinir sistemi) bir dosyayı '/upload' adresine POST ettiğinde...
app.post('/upload', (req, res) => {
  // 1. 'multer' (upload) yardımcısını çağır
  upload(req, res, (err) => {
    if (err) {
      // 2. Bir hata oluştuysa (örn: dosya 5MB'tan büyük veya resim değil)
      console.error('Dosya yükleme hatası:', err.message);
      // Hata mesajını 'client.js'e geri gönder
      res.status(400).json({ error: err.message });
    } else {
      // 3. Dosya başarıyla 'public/uploads' klasörüne kaydedildiyse...
      if (req.file == undefined) {
        return res.status(400).json({ error: 'Dosya seçilmedi!' });
      }
      
      // 4. Resmin yeni adresini (URL) oluştur.
      //    (örn: /uploads/image-1678886598512.png)
      const imageUrl = `/uploads/${req.file.filename}`;
      
      // 5. Bu adresi 'client.js'e JSON formatında geri gönder.
      res.status(200).json({ imageUrl: imageUrl });
    }
  });
});


// --- 4. Adım: Sohbet Sihirbazı (Socket.io) ---
// (Bu bölümde HİÇBİR değişiklik yok. Socket.io'nun resim yüklendiğinden haberi bile yok.
//  O sadece '/uploads/resim.png' şeklinde bir 'chat message' (metin) alacak.)
io.on('connection', (socket) => {
  
  socket.on('join chat', (data) => { /* ...içerik Seviye 6.3 ile aynı... */ 
    const { username, room } = data; 
    socket.join(room); 
    socket.username = username;
    socket.room = room; 
    connectedUsers[socket.id] = { username, room };

    socket.emit('room joined', room);
    io.to(room).emit('update user list', getUsersInRoom(room));
    socket.broadcast.to(room).emit('user joined', username);

    const sql = `SELECT username, message, timestamp FROM messages WHERE room = ? ORDER BY timestamp DESC LIMIT 50`;
    db.all(sql, [room], (err, rows) => {
      if (err) {
        console.error('Mesaj geçmişi çekilirken hata:', err.message);
      } else {
        socket.emit('load history', rows.reverse());
      }
    });
  });

  socket.on('typing', () => { /* ...içerik Seviye 6.3 ile aynı... */ 
    socket.broadcast.to(socket.room).emit('user typing', socket.username);
  });

  socket.on('stop typing', () => { /* ...içerik Seviye 6.3 ile aynı... */ 
    socket.broadcast.to(socket.room).emit('stop typing', socket.username);
  });

  socket.on('chat message', (msg) => { /* ...içerik Seviye 6.3 ile aynı... */ 
    if (!socket.username || !socket.room) return; 

    socket.broadcast.to(socket.room).emit('stop typing', socket.username);
    
    const messageData = { username: socket.username, message: msg };
    io.to(socket.room).emit('chat message', messageData);
    
    const sql = `INSERT INTO messages (room, username, message) VALUES (?, ?, ?)`;
    db.run(sql, [socket.room, socket.username, msg], (err) => {
      if (err) console.error('Mesaj veritabanına kaydedilirken hata:', err.message);
    });
  });

  socket.on('private message', (data) => { /* ...içerik Seviye 6.3 ile aynı... */ 
    const { to, message } = data;
    const from = socket.username;
    const targetSocketId = findSocketIdByUsername(to);

    if (targetSocketId) {
      io.to(targetSocketId).emit('private message', { from, message });
      socket.emit('private message', { to, message });
    } else {
      socket.emit('notification', {
        text: `Hata: '${to}' adlı kullanıcı bulunamadı veya çevrimdışı.`
      });
    }
  });

  socket.on('disconnect', () => { /* ...içerik Seviye 6.3 ile aynı... */ 
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

// --- 5. Adım: Dükkanı Açma (GÜNCELLENDİ) ---
// Render gibi platformlar, kullanmamız gereken portu bize 'process.env.PORT'
// adında bir "çevre değişkeni" ile söyler.
// Eğer bu değişken tanımlı DEĞİLSE (yani kendi bilgisayarımızdaysak), 3000'i kullanırız.
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  // Konsola artık 3000 değil, o an hangi portu dinliyorsak onu yazdırıyoruz.
  console.log(`Sunucu ${PORT} portunda çalışıyor...`);
});