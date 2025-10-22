// === SEVİYE 10.5.3 - GÜNCELLENMİŞ public/client.js ===

const socket = io();

let currentUsername = ''; 

// --- 1. KISIM: HTML Elemanlarını Seçme ---
const loginScreen = document.getElementById('login-screen');
const chatContainer = document.getElementById('chat-container'); 
const loginForm = document.getElementById('login-form');
const usernameInput = document.getElementById('username-input');
const roomInput = document.getElementById('room-input');
const form = document.getElementById('form');
const input = document.getElementById('input');
const fileInput = document.getElementById('file-input');
const messages = document.getElementById('messages');
const userList = document.getElementById('user-list');
const roomNameDisplay = document.getElementById('room-name');
const typingNotification = document.getElementById('typing-notification');

// YENİ EKLENDİ: Mobil menü elemanlarını seç
const menuToggle = document.getElementById('menu-toggle');
const sidebar = document.getElementById('sidebar');

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

// --- YENİ EKLENDİ: MOBİL MENÜ BUTONU OLAYI ---
// Hamburger (☰) butonuna tıklandığında...
menuToggle.addEventListener('click', () => {
    // 'sidebar' elementinin sınıf listesine 'sidebar-visible' sınıfını
    // EKLE (eğer yoksa) veya ÇIKAR (eğer varsa).
    sidebar.classList.toggle('sidebar-visible');
});

// --- Genel Mesaj Gönderme (Değişiklik yok) ---
form.addEventListener('submit', (e) => {
  e.preventDefault(); 
  if (input.value) {
    socket.emit('chat message', input.value);
    socket.emit('stop typing'); 
    input.value = ''; 
  }
});

// --- Dosya Seçme Olayı (Değişiklik yok) ---
fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('image', file);

  fetch('/upload', {
    method: 'POST',
    body: formData
  })
  .then(response => {
    if (!response.ok) {
      return response.json().then(data => { throw new Error(data.error); });
    }
    return response.json();
  })
  .then(data => {
    socket.emit('chat message', data.imageUrl);
  })
  .catch(error => {
    addMessage({ text: `Hata: ${error.message}` }, 'notification');
  });

  fileInput.value = null;
});

// --- "Yazıyor..." ve Özel Mesaj (Değişiklik yok) ---
let typingTimer;
const typingTimeout = 1500; 
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

// --- addMessage Fonksiyonu (Resimleri Anlıyor) (Değişiklik yok) ---
function addMessage(data, type) {
  const item = document.createElement('li');
  
  if (type === 'message') {
    if (data.username === currentUsername) {
      item.classList.add('sent');
    } else {
      item.classList.add('received');
    }
    const isImageMessage = data.message.startsWith('/uploads/');
    let messageContent = '';
    if (isImageMessage) {
      messageContent = `<img src="${data.message}" alt="Yüklenen Resim">`;
    } else {
      messageContent = data.message;
    }
    item.innerHTML = `
      <div class="message-bubble ${isImageMessage ? 'image-only' : ''}">
        <span class="username">${data.username}</span>
        ${messageContent}
      </div>
    `;
  } else if (type === 'notification') {
    item.classList.add('notification');
    item.textContent = data.text;
  } else if (type === 'private-message') {
    item.classList.add('private-message');
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
socket.on('load history', (history) => {
  history.forEach(data => { addMessage(data, 'message'); });
  addMessage({ text: '--- Mesaj geçmişi yüklendi ---' }, 'notification');
});
socket.on('chat message', (data) => addMessage(data, 'message'));
socket.on('user joined', (username) => addMessage({ text: username + ' odaya katıldı.' }, 'notification'));
socket.on('user left', (username) => addMessage({ text: username + ' odadan ayrıldı.' }, 'notification'));
socket.on('notification', (data) => addMessage({ text: data.text }, 'notification'));
socket.on('private message', (data) => addMessage(data, 'private-message'));
socket.on('room joined', (roomName) => { roomNameDisplay.textContent = roomName; });
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