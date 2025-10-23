// === SEVİYE 12.2 - GÜNCELLENMİŞ SERVER.JS (Cloudinary) ===

// Gizli Bilgileri Yükle (.env dosyasını okur)
require('dotenv').config();

// --- 1. Adım: Gerekli Kütüphaneler ---
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const multer = require('multer'); // Hala gerekli ama farklı kullanacağız
const path = require('path'); 
const { Pool } = require('pg'); // PostgreSQL
// --- YENİ EKLENDİ: Cloudinary Kütüphanesi ---
const cloudinary = require('cloudinary').v2;
// --- YENİ EKLENDİ: Veri akışı için ---
const streamifier = require('streamifier');


const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- Statik Dosya Servisi (Değişiklik Yok) ---
// Not: 'public/uploads' klasörünü artık KULLANMAYACAĞIZ ama bu satır kalsın.
app.use(express.static('public'));

// --- GÜNCELLENDİ: MULTER (DOSYA YÜKLEME) AYARLARI ---
// Artık diski değil, HAFIZAYI (MemoryStorage) kullanacağız.
// Dosya adını Cloudinary belirleyecek, biz burada ayarlamıyoruz.
const storage = multer.memoryStorage(); // Diske değil, RAM'e yükle

const upload = multer({ 
  storage: storage, // Hafıza depolamasını kullan
  limits: { fileSize: 5 * 1024 * 1024 }, // Limit: 5 Megabyte
  fileFilter: (req, file, cb) => {
    // Sadece resim dosyalarına izin ver (Bu kısım aynı)
    const filetypes = /jpeg|jpg|png|gif/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) return cb(null, true);
    cb(new Error("Hata: Sadece resim dosyaları yüklenebilir!"));
  }
}).single('image'); 
// --- BİTTİ: MULTER AYARLARI ---


// --- YENİ EKLENDİ: CLOUDINARY AYARLARI ---
// '.env' dosyasından okuduğumuz API anahtarları ile Cloudinary'yi yapılandırıyoruz.
cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true // HTTPS URL'leri kullan
});
// --- BİTTİ: CLOUDINARY AYARLARI ---


// --- Sunucunun "Anlık Hafızası" (Defter) (Değişiklik Yok) ---
let connectedUsers = {};

// --- Sunucunun "Kalıcı Hafızası" (PostgreSQL Pool) (Değişiklik Yok) ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
// Tabloyu oluştur (Değişiklik Yok)
(async () => {
  try {
    await pool.connect();
    console.log('Neon (PostgreSQL) veritabanına başarıyla bağlanıldı.');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY, room TEXT NOT NULL, username TEXT NOT NULL,
        message TEXT NOT NULL, timestamp TIMESTAMPTZ DEFAULT NOW()
      )`);
    console.log("'messages' tablosu başarıyla oluşturuldu/bulundu (PostgreSQL).");
  } catch (err) {
    console.error('Veritabanı bağlantı veya tablo oluşturma hatası:', err);
  }
})();

// --- Yardımcı Fonksiyonlar (Değişiklik Yok) ---
function getUsersInRoom(roomName) { /* ...içerik aynı... */ return []; }
function findSocketIdByUsername(username) { /* ...içerik aynı... */ return null; }
// Gerçek fonksiyonlar
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

// --- 3. Adım: Ana Sayfa ---
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// --- GÜNCELLENDİ: YÜKLEME KAPISI (ENDPOINT) ---
// Artık dosyayı diske değil, Cloudinary'ye gönderiyoruz
app.post('/upload', (req, res) => {
  
  // 1. Önce 'multer' ile dosyayı hafızaya al
  upload(req, res, (err) => {
    if (err) {
      // Multer hatası (boyut, tip vb.)
      console.error('Multer yükleme hatası:', err.message);
      return res.status(400).json({ error: err.message });
    }
    if (req.file == undefined) {
      // Dosya seçilmemişse
      return res.status(400).json({ error: 'Dosya seçilmedi!' });
    }

    // 2. YENİ: Cloudinary'ye Yükleme Fonksiyonu
    let uploadFromBuffer = (buffer) => {
      return new Promise((resolve, reject) => {
        // Cloudinary'nin 'upload_stream' fonksiyonunu çağır
        let cld_upload_stream = cloudinary.uploader.upload_stream(
          {
            // İsteğe bağlı: Resimleri belirli bir klasöre koyabiliriz
            // folder: "sohbet-resimleri", 
            // İsteğe bağlı: Resim boyutunu küçültebiliriz vb.
            // transformation: [{ width: 500, height: 500, crop: "limit" }]
          },
          (error, result) => {
            if (result) {
              resolve(result); // Başarılı: Cloudinary sonucunu döndür
            } else {
              reject(error); // Başarısız: Hatayı döndür
            }
          }
        );
        // Hafızadaki dosyayı (buffer) Cloudinary'ye "akıt" (stream)
        streamifier.createReadStream(buffer).pipe(cld_upload_stream);
      });
    };

    // 3. Yükleme işlemini başlat
    uploadFromBuffer(req.file.buffer)
      .then(result => {
        // 4. BAŞARILI: Cloudinary resmi yükledi ve bize URL verdi
        console.log('Cloudinary yükleme başarılı:', result.secure_url);
        // Cloudinary'nin verdiği GÜVENLİ (https) URL'i client'a gönder
        res.status(200).json({ imageUrl: result.secure_url });
      })
      .catch(error => {
        // 5. HATA: Cloudinary yüklemesi başarısız oldu
        console.error('Cloudinary yükleme hatası:', error);
        res.status(500).json({ error: 'Resim Cloudinary\'ye yüklenemedi.' });
      });
      
  }); // multer upload bitişi
}); // app.post('/upload') bitişi


// --- 4. Adım: Sohbet Sihirbazı (Socket.io) ---
// (Bu bölümde HİÇBİR değişiklik yok. O hala metin mesajı olarak 
//  Cloudinary URL'ini alacak ve veritabanına kaydedecek.)
io.on('connection', (socket) => {
  
  socket.on('join chat', (data) => { /* ...içerik Seviye 11.2 ile aynı... */ });
  socket.on('typing', () => { /* ...içerik Seviye 11.2 ile aynı... */ });
  socket.on('stop typing', () => { /* ...içerik Seviye 11.2 ile aynı... */ });
  socket.on('chat message', (msg) => { /* ...içerik Seviye 11.2 ile aynı... */ });
  socket.on('private message', (data) => { /* ...içerik Seviye 11.2 ile aynı... */ });
  socket.on('disconnect', () => { /* ...içerik Seviye 11.2 ile aynı... */ });

  // Tam kodlar (kısa versiyonları değil)
  socket.on('join chat', (data) => {
    const { username, room } = data; 
    socket.join(room); 
    socket.username = username;
    socket.room = room; 
    connectedUsers[socket.id] = { username, room };

    socket.emit('room joined', room);
    io.to(room).emit('update user list', getUsersInRoom(room));
    socket.broadcast.to(room).emit('user joined', username);

    (async () => {
      try {
        const sql = `SELECT username, message, timestamp FROM messages WHERE room = $1 ORDER BY timestamp ASC LIMIT 50`;
        const history = await pool.query(sql, [room]);
        socket.emit('load history', history.rows);
      } catch (err) { console.error('Mesaj geçmişi çekilirken hata (PostgreSQL):', err); }
    })();
  });
  socket.on('typing', () => { socket.broadcast.to(socket.room).emit('user typing', socket.username); });
  socket.on('stop typing', () => { socket.broadcast.to(socket.room).emit('stop typing', socket.username); });
  socket.on('chat message', (msg) => {
    if (!socket.username || !socket.room) return; 
    socket.broadcast.to(socket.room).emit('stop typing', socket.username);
    const messageData = { username: socket.username, message: msg };
    io.to(socket.room).emit('chat message', messageData);
    const sql = `INSERT INTO messages (room, username, message) VALUES ($1, $2, $3)`;
    pool.query(sql, [socket.room, socket.username, msg], (err, res) => {
      if (err) console.error('Mesaj kaydedilirken hata (PostgreSQL):', err);
    });
  });
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
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Sunucu ${PORT} portunda çalışıyor...`);
});