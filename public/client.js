// === SEVİYE 9.4 - GÜNCELLENMİŞ public/client.js ===

const socket = io();

let currentUsername = ''; // Kendi adımızı saklamak için

// --- 1. KISIM: HTML Elemanlarını Seçme ---
const loginScreen = document.getElementById('login-screen');
const chatContainer = document.getElementById('chat-container'); 
const loginForm = document.getElementById('login-form');
const usernameInput = document.getElementById('username-input');
const roomInput = document.getElementById('room-input');
const form = document.getElementById('form');
const input = document.getElementById('input');
// YENİ EKLENDİ: Dosya seçme butonunu da seçiyoruz
const fileInput = document.getElementById('file-input');
const messages = document.getElementById('messages');
const userList = document.getElementById('user-list');
const roomNameDisplay = document.getElementById('room-name');
const typingNotification = document.getElementById('typing-notification');

// --- 2. KISIM: Olay Dinleyicileri (Kullanıcı Ne Yaptı?) ---

// --- Giriş Yapma İşlemi (Değişiklik yok) ---
loginForm.addEventListener('submit', (e) => {
  e.preventDefault(); 
  if (usernameInput.value && roomInput.value) {
    currentUsername = usernameInput.value; 
    socket.emit('join chat', {
      username: currentUsername,
      room: roomInput.value
    });
    loginScreen.style.display = 'none';
    chatContainer.style.display = 'flex'; 
    input.focus(); 
  }
});

// --- Genel Mesaj Gönderme (Metin) (Değişiklik yok) ---
form.addEventListener('submit', (e) => {
  e.preventDefault(); 
  // Sadece 'input' (metin kutusu) doluysa metin gönder
  if (input.value) {
    socket.emit('chat message', input.value);
    socket.emit('stop typing'); 
    input.value = ''; 
  }
});

// --- YENİ EKLENDİ: DOSYA SEÇME OLAYI ---
// Kullanıcı "ataç" ikonuna basıp bir dosya seçtiğinde ('change')...
fileInput.addEventListener('change', () => {
  // 1. Seçilen dosyayı al (sadece ilk dosyayı)
  const file = fileInput.files[0];
  if (!file) {
    return; // Dosya seçilmediyse bir şey yapma
  }

  // 2. Bir 'FormData' objesi oluştur (dosyaları HTTP ile göndermenin yolu)
  const formData = new FormData();
  // 'multer'ın beklediği 'image' alan adına dosyayı ekle
  formData.append('image', file);

  // 3. 'fetch' kullanarak dosyayı sunucudaki '/upload' kapısına POST et
  fetch('/upload', {
    method: 'POST',
    body: formData
  })
  .then(response => {
    // 4. Sunucudan cevap gelince, onu JSON olarak oku
    if (!response.ok) {
      // Eğer sunucu hata verdiyse (örn: resim değil, dosya çok büyük)
      // hatayı JSON'dan oku ve fırlat
      return response.json().then(data => { throw new Error(data.error); });
    }
    return response.json(); // Başarılıysa, JSON'u (örn: {imageUrl: '...'}) al
  })
  .then(data => {
    // 5. BAŞARILI: Sunucudan resmin adresi (data.imageUrl) geldi
    //    Bu adresi normal bir 'chat message' olarak sokete (odaya) gönder
    socket.emit('chat message', data.imageUrl);
  })
  .catch(error => {
    // 6. HATA: Yükleme başarısız oldu
    console.error('Dosya yükleme hatası:', error.message);
    // Hatayı ekranda bir bildirim olarak göster
    addMessage({ text: `Hata: ${error.message}` }, 'notification');
  });

  // 7. Dosya input'unu temizle ki aynı dosyayı tekrar seçebilsin
  fileInput.value = null;
});
// --- BİTTİ: DOSYA SEÇME OLAYI ---


// --- "Yazıyor..." ve Özel Mesaj (Değişiklik yok) ---
let typingTimer;
const typingTimeout = 1500; 
input.addEventListener('keyup', () => { /* ...içerik aynı... */ });
userList.addEventListener('click', (e) => { /* ...içerik aynı... */ });
// (Kodları kısa tutmak için içeriklerini kestim, sizde tamamı olmalı)
input.addEventListener('keyup', () => {
  socket.emit('typing'); 
  clearTimeout(typingTimer); 
  typingTimer = setTimeout(() => {
    socket.emit('stop typing');
  }, typingTimeout);
});
userList.addEventListener('click', (e) => {
  if (e.target && e.target.matches('li.user')) {
    const targetUsername = e.target.textContent; 
    if (targetUsername !== currentUsername) {
      const message = prompt(`Kime: ${targetUsername} - Fısıltınız:`);
      if (message) {
        socket.emit('private message', { to: targetUsername, message: message });
      }
    }
  }
});


// --- 3. KISIM: Sunucudan Gelenleri Dinleme ---

// --- BÜYÜK GÜNCELLEME: addMessage Fonksiyonu (Resimleri Anlıyor) ---
function addMessage(data, type) {
  const item = document.createElement('li');
  
  if (type === 'message') {
    // Gelen/Giden (sağ/sol) ayrımını yap
    if (data.username === currentUsername) {
      item.classList.add('sent');
    } else {
      item.classList.add('received');
    }

    // --- YENİ EKLENDİ: Gelen mesaj resim mi, metin mi? ---
    const isImageMessage = data.message.startsWith('/uploads/');
    
    // CSS'in beklediği yeni baloncuk HTML'i
    let messageContent = '';
    
    if (isImageMessage) {
      // EĞER MESAJ RESİMSE:
      // Mesajı, bir <img> etiketi olarak bas
      messageContent = `<img src="${data.message}" alt="Yüklenen Resim">`;
    } else {
      // EĞER MESAJ METİNSE:
      // Mesajı normal metin olarak bas
      messageContent = data.message;
    }
    
    item.innerHTML = `
      <div class="message-bubble ${isImageMessage ? 'image-only' : ''}">
        <span class="username">${data.username}</span>
        ${messageContent}
      </div>
    `;
    // --- BİTTİ: RESİM KONTROLÜ ---
    
  } else if (type === 'notification') {
    item.classList.add('notification');
    item.textContent = data.text;
  } else if (type === 'private-message') {
    item.classList.add('private-message');
    if (data.from) { /* ...içerik aynı... */ } else if (data.to) { /* ...içerik aynı... */ }
    // (Kodları kısa tutmak için içeriklerini kestim)
    if (data.from) {
      item.innerHTML = `<span class="pm-direction">[<span class="pm-user">${data.from}</span>'dan fısıltı]</span> ${data.message}`;
    } else if (data.to) {
      item.innerHTML = `<span class="pm-direction">[<span class="pm-user">${data.to}</span>'e fısıltı]</span> ${data.message}`;
    }
  }
  
  messages.appendChild(item);
  messages.scrollTop = messages.scrollHeight; 
}

// --- Diğer Dinleyiciler (Hiç değişiklik yok) ---
// ('load history' ve 'chat message' artık 'addMessage' fonksiyonu
//  sayesinde resimleri otomatik olarak doğru gösterecek)
socket.on('load history', (history) => {
  history.forEach(data => {
    addMessage(data, 'message'); 
  });
  addMessage({ text: '--- Mesaj geçmişi yüklendi ---' }, 'notification');
});
socket.on('chat message', (data) => addMessage(data, 'message'));
socket.on('user joined', (username) => addMessage({ text: username + ' odaya katıldı.' }, 'notification'));
socket.on('user left', (username) => addMessage({ text: username + ' odadan ayrıldı.' }, 'notification'));
socket.on('notification', (data) => addMessage({ text: data.text }, 'notification'));
socket.on('private message', (data) => addMessage(data, 'private-message'));
socket.on('room joined', (roomName) => {
  roomNameDisplay.textContent = roomName;
});
socket.on('update user list', (users) => {
  userList.innerHTML = ''; 
  users.forEach(username => { 
    const item = document.createElement('li');
    item.classList.add('user');
    item.textContent = username;
    userList.appendChild(item); 
  });
});
socket.on('user typing', (username) => {
  usersTyping[username] = true; 
  updateTypingNotification();
});
socket.on('stop typing', (username) => {
  delete usersTyping[username]; 
  updateTypingNotification();
});

let usersTyping = {}; 
function updateTypingNotification() {
  const names = Object.keys(usersTyping); 
  if (names.length === 0) {
    typingNotification.textContent = '';
  } else if (names.length === 1) {
    typingNotification.textContent = names[0] + ' yazıyor...';
  } else {
    typingNotification.textContent = names.join(' ve ') + ' yazıyor...';
  }
}