// === SEVİYE 14.2 - GÜNCELLENMİŞ public/client.js ===

// Socket'i başlangıçta BAĞLAMA!
let socket = null;
let currentUsername = '';

// --- 1. KISIM: HTML Elemanlarını Seçme (Değişiklik yok) ---
const loginScreen = document.getElementById('login-screen');
const chatContainer = document.getElementById('chat-container');
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
const roomSelectionContainer = document.getElementById('room-selection-container');
const roomForm = document.getElementById('room-form');
const roomInput = document.getElementById('room-input');
const logoutButtonRoom = document.getElementById('logout-button-room');
const chatContainer = document.getElementById('chat-container');
const sidebar = document.getElementById('sidebar');
const menuToggle = document.getElementById('menu-toggle');
const logoutButtonChat = document.getElementById('logout-button-chat');
const roomNameDisplay = document.getElementById('room-name');
const userList = document.getElementById('user-list');
const messages = document.getElementById('messages');
const typingNotification = document.getElementById('typing-notification');
const messageForm = document.getElementById('form');
const messageInput = document.getElementById('input');
const fileInput = document.getElementById('file-input');

// --- 2. KISIM: Yardımcı Fonksiyonlar (Değişiklik yok) ---
function showError(element, message) { /* ... içerik aynı ... */ }
function clearErrors() { /* ... içerik aynı ... */ }
function showScreen(screenToShow) { /* ... içerik aynı ... */ }
// Tam kodlar:
function showError(element, message) { element.textContent = message; }
function clearErrors() { loginErrorEl.textContent = ''; registerErrorEl.textContent = ''; registerSuccessEl.textContent = ''; }
function showScreen(screenToShow) {
    authContainer.style.display = 'none';
    roomSelectionContainer.style.display = 'none';
    chatContainer.style.display = 'none';
    screenToShow.style.display = 'block';
     if(screenToShow === chatContainer) screenToShow.style.display = 'flex';
}

// --- 3. KISIM: Kimlik Doğrulama (Auth) Mantığı (Değişiklik yok) ---
showRegisterLink.addEventListener('click', (e) => { /* ... içerik aynı ... */ });
showLoginLink.addEventListener('click', (e) => { /* ... içerik aynı ... */ });
registerForm.addEventListener('submit', async (e) => { /* ... içerik aynı ... */ });
loginForm.addEventListener('submit', async (e) => { /* ... içerik aynı ... */ });
async function handleLogout() { /* ... içerik aynı ... */ }
logoutButtonRoom.addEventListener('click', handleLogout);
logoutButtonChat.addEventListener('click', handleLogout);
async function checkAuthOnLoad() { /* ... içerik aynı ... */ }
// Tam kodlar:
showRegisterLink.addEventListener('click', (e) => { e.preventDefault(); clearErrors(); loginFormContainer.style.display = 'none'; registerFormContainer.style.display = 'block'; });
showLoginLink.addEventListener('click', (e) => { e.preventDefault(); clearErrors(); registerFormContainer.style.display = 'none'; loginFormContainer.style.display = 'block'; });
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault(); clearErrors();
    const username = registerUsernameInput.value; const password = registerPasswordInput.value;
    try {
        const response = await fetch('/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }), });
        const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Kayıt başarısız.');
        registerSuccessEl.textContent = data.message + ' Şimdi giriş yapabilirsiniz.'; registerForm.reset();
        setTimeout(() => { showLoginLink.click(); }, 1000);
    } catch (error) { showError(registerErrorEl, error.message); }
});
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault(); clearErrors();
    const username = loginUsernameInput.value; const password = loginPasswordInput.value;
    try {
        const response = await fetch('/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }), });
        const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Giriş başarısız.');
        currentUsername = data.user.username; showScreen(roomSelectionContainer); initializeSocket();
    } catch (error) { showError(loginErrorEl, error.message); }
});
async function handleLogout() {
     if (socket) { socket.disconnect(); socket = null; }
    try { await fetch('/logout', { method: 'POST' }); }
    catch (error) { console.error('Çıkış hatası:', error); }
    finally { currentUsername = ''; clearChatUI(); showScreen(authContainer); }
}
async function checkAuthOnLoad() {
    try {
        const response = await fetch('/check-auth'); const data = await response.json();
        if (data.loggedIn) { currentUsername = data.user.username; showScreen(roomSelectionContainer); initializeSocket(); }
        else { showScreen(authContainer); }
    } catch (error) { console.error('Oturum kontrol hatası:', error); showScreen(authContainer); }
}


// --- 4. KISIM: Socket.IO ve Sohbet Mantığı ---

function initializeSocket() {
    if (socket) return;
    socket = io();

    // Oda Katılma Formu (Değişiklik yok)
    roomForm.addEventListener('submit', (e) => {
        e.preventDefault(); const room = roomInput.value;
        if (room && socket) { socket.emit('join chat', { room }); showScreen(chatContainer); messageInput.focus(); }
    });

    // Socket Olay Dinleyicileri
    socket.on('room joined', (roomName) => { roomNameDisplay.textContent = roomName; clearChatUI(false); });

    // addMessage Fonksiyonu (Değişiklik yok)
    function addMessage(data, type) { /* ... içerik Seviye 12.3 ile aynı ... */ }
    // Tam kod:
    addMessage = (data, type) => {
        const item = document.createElement('li');
        if (type === 'message') {
            if (data.username === currentUsername) item.classList.add('sent'); else item.classList.add('received');
            const isImageMessage = data.message.startsWith('https://res.cloudinary.com/'); let messageContent = '';
            if (isImageMessage) messageContent = `<img src="${data.message}" alt="Yüklenen Resim">`; else messageContent = data.message;
            item.innerHTML = `<div class="message-bubble ${isImageMessage ? 'image-only' : ''}"><span class="username">${data.username}</span>${messageContent}</div>`;
        } else if (type === 'notification') {
            item.classList.add('notification'); item.textContent = data.text;
        } else if (type === 'private-message') {
            item.classList.add('private-message');
            if (data.from) item.innerHTML = `<span class="pm-direction">[<span class="pm-user">${data.from}</span>'dan fısıltı]</span> ${data.message}`;
            else if (data.to) item.innerHTML = `<span class="pm-direction">[<span class="pm-user">${data.to}</span>'e fısıltı]</span> ${data.message}`;
        }
        messages.appendChild(item); messages.scrollTop = messages.scrollHeight;
    }


    // Mesaj Geçmişi Yükleme (Değişiklik yok)
    socket.on('load history', (history) => {
        messages.innerHTML = '';
        history.forEach(data => { addMessage(data, 'message'); });
        addMessage({ text: '--- Mesaj geçmişi yüklendi ---' }, 'notification');
    });

    // Diğer Socket Dinleyicileri (chat message vb. - Değişiklik yok)
    socket.on('chat message', (data) => addMessage(data, 'message'));
    socket.on('user joined', (username) => addMessage({ text: username + ' odaya katıldı.' }, 'notification'));
    socket.on('user left', (username) => addMessage({ text: username + ' odadan ayrıldı.' }, 'notification'));
    socket.on('notification', (data) => addMessage({ text: data.text }, 'notification'));
    socket.on('private message', (data) => addMessage(data, 'private-message'));

    // --- GÜNCELLENDİ: Kullanıcı Listesini Güncelleme ---
    socket.on('update user list', (users) => {
        userList.innerHTML = ''; // Listeyi temizle
        users.forEach(username => { // Sunucudan gelen HER BİR 'username' için
            const item = document.createElement('li');
            item.classList.add('user');

            // YENİ: Yeşil noktayı (span) oluştur
            const indicator = document.createElement('span');
            indicator.classList.add('online-indicator');

            // YENİ: Kullanıcı adını bir metin olarak oluştur
            const nameText = document.createTextNode(username);

            // YENİ: ÖNCE noktayı, SONRA ismi 'li'ye ekle
            item.appendChild(indicator);
            item.appendChild(nameText);

            // Eski: item.textContent = username; satırını SİLDİK.

            userList.appendChild(item); // Hazırlanan 'li'yi listeye ekle
        });
    });
    // --- BİTTİ: Kullanıcı Listesini Güncelleme ---


    socket.on('user typing', (username) => { usersTyping[username] = true; updateTypingNotification(); });
    socket.on('stop typing', (username) => { delete usersTyping[username]; updateTypingNotification(); });
    socket.on('disconnect', (reason) => { /* ... içerik aynı ... */ });
    socket.on('connect_error', (err) => { /* ... içerik aynı ... */ });
    // Tam disconnect/connect_error kodları:
    socket.on('disconnect', (reason) => { console.log('Socket bağlantısı kesildi:', reason); });
    socket.on('connect_error', (err) => { console.error('Socket bağlantı hatası:', err.message); if (authContainer.style.display === 'none' && roomSelectionContainer.style.display === 'none') { showScreen(authContainer); } });


} // initializeSocket bitişi


// --- 5. KISIM: Diğer Arayüz Mantığı (Değişiklik yok) ---
menuToggle.addEventListener('click', () => { sidebar.classList.toggle('sidebar-visible'); });
let usersTyping = {};
function updateTypingNotification() { /* ... içerik aynı ... */ }
function clearChatUI(clearRoomName = true) { /* ... içerik aynı ... */ }
messageForm.addEventListener('submit', (e) => { /* ... içerik aynı ... */ });
fileInput.addEventListener('change', () => { /* ... içerik aynı ... */ });
userList.addEventListener('click', (e) => { /* ... içerik aynı ... */ });
// Tam kodlar:
updateTypingNotification = () => { const names = Object.keys(usersTyping); if (names.length === 0) typingNotification.textContent = ''; else if (names.length === 1) typingNotification.textContent = names[0] + ' yazıyor...'; else typingNotification.textContent = names.join(' ve ') + ' yazıyor...'; }
function clearChatUI(clearRoomName = true) { if(clearRoomName) roomNameDisplay.textContent = '...'; userList.innerHTML = ''; messages.innerHTML = ''; typingNotification.textContent = ''; sidebar.classList.remove('sidebar-visible'); }
messageForm.addEventListener('submit', (e) => { e.preventDefault(); if (messageInput.value && socket) { socket.emit('chat message', messageInput.value); socket.emit('stop typing'); messageInput.value = ''; } });
fileInput.addEventListener('change', () => { const file = fileInput.files[0]; if (!file) return; const formData = new FormData(); formData.append('image', file); fetch('/upload', { method: 'POST', body: formData }).then(response => { if (!response.ok) return response.json().then(data => { throw new Error(data.error); }); return response.json(); }).then(data => { if(socket) socket.emit('chat message', data.imageUrl); }).catch(error => { addMessage({ text: `Hata: ${error.message}` }, 'notification'); }); fileInput.value = null; });
userList.addEventListener('click', (e) => { if (e.target && e.target.matches('li.user')) { const targetUsername = e.target.textContent; if (targetUsername !== currentUsername && socket) { const message = prompt(`Kime: ${targetUsername.substring(1)} - Fısıltınız:`); /* substring(1) noktayı kaldırır */ if (message) socket.emit('private message', { to: targetUsername.substring(1), message: message }); } } }); // DÜZELTME: substring(1) ekledik


// --- UYGULAMAYI BAŞLAT ---
document.addEventListener('DOMContentLoaded', checkAuthOnLoad);