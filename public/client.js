// === SEVİYE 13.3 - YENİ public/client.js ===

// Socket'i başlangıçta BAĞLAMA! Sadece giriş yaptıktan sonra bağlanacağız.
let socket = null;
let currentUsername = '';

// --- 1. KISIM: HTML Elemanlarını Seçme ---
// Auth Ekranları
const authContainer = document.getElementById('auth-container');
const loginFormContainer = document.getElementById('login-form-container');
const registerFormContainer = document.getElementById('register-form-container');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginUsernameInput = document.getElementById('login-username');
const loginPasswordInput = document.getElementById('login-password');
const registerUsernameInput = document.getElementById('register-username');
const registerPasswordInput = document.getElementById('register-password');
const loginErrorEl = document.getElementById('login-error');
const registerErrorEl = document.getElementById('register-error');
const registerSuccessEl = document.getElementById('register-success');
const showRegisterLink = document.getElementById('show-register');
const showLoginLink = document.getElementById('show-login');

// Oda Seçim Ekranı
const roomSelectionContainer = document.getElementById('room-selection-container');
const roomForm = document.getElementById('room-form');
const roomInput = document.getElementById('room-input');
const logoutButtonRoom = document.getElementById('logout-button-room');

// Sohbet Ekranı
const chatContainer = document.getElementById('chat-container');
const sidebar = document.getElementById('sidebar');
const menuToggle = document.getElementById('menu-toggle');
const logoutButtonChat = document.getElementById('logout-button-chat');
const roomNameDisplay = document.getElementById('room-name');
const userList = document.getElementById('user-list');
const messages = document.getElementById('messages');
const typingNotification = document.getElementById('typing-notification');
const messageForm = document.getElementById('form'); // Formun ID'si hala 'form'
const messageInput = document.getElementById('input');
const fileInput = document.getElementById('file-input');

// --- 2. KISIM: Yardımcı Fonksiyonlar ---
function showError(element, message) {
    element.textContent = message;
}
function clearErrors() {
    loginErrorEl.textContent = '';
    registerErrorEl.textContent = '';
    registerSuccessEl.textContent = '';
}
function showScreen(screenToShow) {
    authContainer.style.display = 'none';
    roomSelectionContainer.style.display = 'none';
    chatContainer.style.display = 'none';
    screenToShow.style.display = 'block'; // Sadece istenen ekranı göster
     if(screenToShow === chatContainer) {
        screenToShow.style.display = 'flex'; // Chat container flex olmalı
    }
}

// --- 3. KISIM: Kimlik Doğrulama (Auth) Mantığı ---

// Formlar arası geçiş linkleri
showRegisterLink.addEventListener('click', (e) => {
    e.preventDefault();
    clearErrors();
    loginFormContainer.style.display = 'none';
    registerFormContainer.style.display = 'block';
});
showLoginLink.addEventListener('click', (e) => {
    e.preventDefault();
    clearErrors();
    registerFormContainer.style.display = 'none';
    loginFormContainer.style.display = 'block';
});

// Kayıt Formu Gönderimi
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();
    const username = registerUsernameInput.value;
    const password = registerPasswordInput.value;
    try {
        const response = await fetch('/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Kayıt başarısız.');
        }
        registerSuccessEl.textContent = data.message + ' Şimdi giriş yapabilirsiniz.';
        registerForm.reset(); // Formu temizle
        // Otomatik olarak giriş formuna geç
        setTimeout(() => {
             showLoginLink.click();
        }, 1000);
    } catch (error) {
        showError(registerErrorEl, error.message);
    }
});

// Giriş Formu Gönderimi
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();
    const username = loginUsernameInput.value;
    const password = loginPasswordInput.value;
    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Giriş başarısız.');
        }
        // BAŞARILI GİRİŞ!
        currentUsername = data.user.username; // Kullanıcı adını sakla
        showScreen(roomSelectionContainer); // Oda seçim ekranını göster
        initializeSocket(); // Socket.IO bağlantısını KUR!
    } catch (error) {
        showError(loginErrorEl, error.message);
    }
});

// Çıkış Yapma Mantığı (Her iki buton için de aynı)
async function handleLogout() {
     if (socket) {
        socket.disconnect(); // Socket bağlantısını kes
        socket = null;
    }
    try {
        await fetch('/logout', { method: 'POST' });
    } catch (error) {
        console.error('Çıkış hatası:', error);
    } finally {
        currentUsername = '';
        clearChatUI(); // Sohbet arayüzünü temizle
        showScreen(authContainer); // Giriş ekranını göster
    }
}
logoutButtonRoom.addEventListener('click', handleLogout);
logoutButtonChat.addEventListener('click', handleLogout);

// Sayfa Yüklendiğinde Oturum Kontrolü
async function checkAuthOnLoad() {
    try {
        const response = await fetch('/check-auth');
        const data = await response.json();
        if (data.loggedIn) {
            currentUsername = data.user.username;
            showScreen(roomSelectionContainer); // Direkt oda seçimine git
            initializeSocket(); // Socket'i başlat
        } else {
            showScreen(authContainer); // Giriş ekranını göster
        }
    } catch (error) {
        console.error('Oturum kontrol hatası:', error);
        showScreen(authContainer); // Hata olursa giriş ekranını göster
    }
}

// --- 4. KISIM: Socket.IO ve Sohbet Mantığı ---

// Socket bağlantısını başlatan fonksiyon (sadece giriş yapınca çağrılır)
function initializeSocket() {
    if (socket) return; // Zaten bağlıysa tekrar bağlama

    socket = io(); // Bağlantıyı KUR!

    // --- Odaya Katılma Formu ---
    roomForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const room = roomInput.value;
        if (room && socket) {
            // SADECE oda adını gönderiyoruz, username sunucudaki session'dan gelecek
            socket.emit('join chat', { room });
            showScreen(chatContainer); // Sohbet ekranını göster
            messageInput.focus();
        }
    });

    // --- Socket Olay Dinleyicileri (Artık 'socket' değişkeni dolu) ---

    // Odaya Katılınca Oda Adını Yaz
    socket.on('room joined', (roomName) => {
        roomNameDisplay.textContent = roomName;
        clearChatUI(false); // Sadece mesajları temizle
    });

    // Mesaj/Bildirim ekleme fonksiyonu (Değişiklik yok)
    function addMessage(data, type) { /* ... içerik Seviye 12.3 ile aynı ... */ }
     // Tam kod:
    addMessage = (data, type) => {
        const item = document.createElement('li');
        if (type === 'message') {
            if (data.username === currentUsername) item.classList.add('sent');
            else item.classList.add('received');
            const isImageMessage = data.message.startsWith('https://res.cloudinary.com/');
            let messageContent = '';
            if (isImageMessage) messageContent = `<img src="${data.message}" alt="Yüklenen Resim">`;
            else messageContent = data.message;
            item.innerHTML = `<div class="message-bubble ${isImageMessage ? 'image-only' : ''}"><span class="username">${data.username}</span>${messageContent}</div>`;
        } else if (type === 'notification') {
            item.classList.add('notification'); item.textContent = data.text;
        } else if (type === 'private-message') {
            item.classList.add('private-message');
            if (data.from) item.innerHTML = `<span class="pm-direction">[<span class="pm-user">${data.from}</span>'dan fısıltı]</span> ${data.message}`;
            else if (data.to) item.innerHTML = `<span class="pm-direction">[<span class="pm-user">${data.to}</span>'e fısıltı]</span> ${data.message}`;
        }
        messages.appendChild(item);
        messages.scrollTop = messages.scrollHeight;
    }


    // Mesaj Geçmişi Yükleme
    socket.on('load history', (history) => {
        messages.innerHTML = ''; // Önce temizle
        history.forEach(data => { addMessage(data, 'message'); });
        addMessage({ text: '--- Mesaj geçmişi yüklendi ---' }, 'notification');
    });

    // Diğer Socket Dinleyicileri (Değişiklik yok)
    socket.on('chat message', (data) => addMessage(data, 'message'));
    socket.on('user joined', (username) => addMessage({ text: username + ' odaya katıldı.' }, 'notification'));
    socket.on('user left', (username) => addMessage({ text: username + ' odadan ayrıldı.' }, 'notification'));
    socket.on('notification', (data) => addMessage({ text: data.text }, 'notification'));
    socket.on('private message', (data) => addMessage(data, 'private-message'));
    socket.on('update user list', (users) => {
        userList.innerHTML = '';
        users.forEach(username => {
            const item = document.createElement('li'); item.classList.add('user');
            item.textContent = username; userList.appendChild(item);
        });
    });
    socket.on('user typing', (username) => { usersTyping[username] = true; updateTypingNotification(); });
    socket.on('stop typing', (username) => { delete usersTyping[username]; updateTypingNotification(); });

    // Bağlantı Kesilirse (örn: sunucu yeniden başlarsa)
    socket.on('disconnect', (reason) => {
        console.log('Socket bağlantısı kesildi:', reason);
        // İsteğe bağlı: Kullanıcıyı tekrar giriş ekranına yönlendirebiliriz
        // alert('Bağlantı kesildi. Lütfen tekrar giriş yapın.');
        // handleLogout();
    });

     // Hata olursa (örn: sunucu 'Authentication required' hatası verirse)
    socket.on('connect_error', (err) => {
        console.error('Socket bağlantı hatası:', err.message);
        // Giriş ekranını göster (eğer zaten gösterilmiyorsa)
        if (authContainer.style.display === 'none' && roomSelectionContainer.style.display === 'none') {
             showScreen(authContainer);
        }
    });

} // initializeSocket bitişi


// --- 5. KISIM: Diğer Arayüz Mantığı ---

// Mobil Menü Butonu (Değişiklik yok)
menuToggle.addEventListener('click', () => { sidebar.classList.toggle('sidebar-visible'); });

// "Yazıyor..." Bildirimi (Değişiklik yok)
let usersTyping = {};
function updateTypingNotification() { /* ... içerik Seviye 12.3 ile aynı ... */ }
// Tam kod:
updateTypingNotification = () => {
    const names = Object.keys(usersTyping);
    if (names.length === 0) typingNotification.textContent = '';
    else if (names.length === 1) typingNotification.textContent = names[0] + ' yazıyor...';
    else typingNotification.textContent = names.join(' ve ') + ' yazıyor...';
}


// Sohbet Arayüzünü Temizleme Fonksiyonu (Çıkış yaparken kullanılır)
function clearChatUI(clearRoomName = true) {
    if(clearRoomName) roomNameDisplay.textContent = '...';
    userList.innerHTML = '';
    messages.innerHTML = '';
    typingNotification.textContent = '';
    sidebar.classList.remove('sidebar-visible'); // Menüyü kapat
}

// Genel Mesaj Formu (Değişiklik yok)
messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (messageInput.value && socket) { // Sadece socket bağlıysa gönder
        socket.emit('chat message', messageInput.value);
        socket.emit('stop typing');
        messageInput.value = '';
    }
});

// Dosya Seçme Olayı (Değişiklik yok)
fileInput.addEventListener('change', () => { /* ... içerik Seviye 12.3 ile aynı ... */ });
// Tam kod:
fileInput.addEventListener('change', () => {
    const file = fileInput.files[0]; if (!file) return;
    const formData = new FormData(); formData.append('image', file);
    fetch('/upload', { method: 'POST', body: formData })
        .then(response => { if (!response.ok) return response.json().then(data => { throw new Error(data.error); }); return response.json(); })
        .then(data => { if(socket) socket.emit('chat message', data.imageUrl); }) // Sadece socket bağlıysa gönder
        .catch(error => { addMessage({ text: `Hata: ${error.message}` }, 'notification'); });
    fileInput.value = null;
});

// Özel Mesaj (Değişiklik yok)
userList.addEventListener('click', (e) => {
    if (e.target && e.target.matches('li.user')) {
        const targetUsername = e.target.textContent;
        if (targetUsername !== currentUsername && socket) { // Sadece socket bağlıysa
            const message = prompt(`Kime: ${targetUsername} - Fısıltınız:`);
            if (message) socket.emit('private message', { to: targetUsername, message: message });
        }
    }
});


// --- UYGULAMAYI BAŞLAT ---
// Sayfa ilk yüklendiğinde oturum durumunu kontrol et
document.addEventListener('DOMContentLoaded', checkAuthOnLoad);