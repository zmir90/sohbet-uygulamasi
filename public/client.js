// === SEVİYE 13 - NİHAİ TEMİZ client.js ===

let socket = null;
let currentUsername = '';

// --- 1. KISIM: HTML Elemanlarını Seçme ---
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

// --- 2. KISIM: Yardımcı Fonksiyonlar ---
function showError(element, message) { element.textContent = message; }
function clearErrors() { loginErrorEl.textContent = ''; registerErrorEl.textContent = ''; registerSuccessEl.textContent = ''; }
function showScreen(screenToShow) {
    authContainer.style.display = 'none';
    roomSelectionContainer.style.display = 'none';
    chatContainer.style.display = 'none';
    screenToShow.style.display = 'block';
     if(screenToShow === chatContainer) screenToShow.style.display = 'flex';
}

// --- 3. KISIM: Kimlik Doğrulama (Auth) Mantığı ---
showRegisterLink.addEventListener('click', (e) => { e.preventDefault(); clearErrors(); loginFormContainer.style.display = 'none'; registerFormContainer.style.display = 'block'; });
showLoginLink.addEventListener('click', (e) => { e.preventDefault(); clearErrors(); registerFormContainer.style.display = 'none'; loginFormContainer.style.display = 'block'; });
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault(); clearErrors();
    const username = registerUsernameInput.value; const password = registerPasswordInput.value;
    try {
        const response = await fetch('/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }), });
        const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Kayıt başarısız.');
        registerSuccessEl.textContent = data.message + ' Şimdi giriş yapabilirsiniz.'; registerForm.reset();
        setTimeout(() => { showLoginLink.click(); }, 1500); // Başarı mesajını görmek için biraz bekle
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
logoutButtonRoom.addEventListener('click', handleLogout);
logoutButtonChat.addEventListener('click', handleLogout);
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
    roomForm.addEventListener('submit', (e) => {
        e.preventDefault(); const room = roomInput.value;
        if (room && socket) { socket.emit('join chat', { room }); showScreen(chatContainer); messageInput.focus(); }
    });
    socket.on('room joined', (roomName) => { roomNameDisplay.textContent = roomName; clearChatUI(false); });
    function addMessage(data, type) {
        const item = document.createElement('li');
        if (data.id) item.dataset.messageId = data.id;
        if (type === 'message') {
            if (data.username === currentUsername) item.classList.add('sent'); else item.classList.add('received');
            if (data.is_deleted) { item.classList.add('deleted-message'); item.innerHTML = `[Mesaj silindi]`; }
            else {
                const isImageMessage = data.message.startsWith('https://res.cloudinary.com/'); let messageContent = '';
                if (isImageMessage) messageContent = `<img src="${data.message}" alt="Yüklenen Resim">`; else messageContent = data.message;
                const editedIndicator = data.edited_at ? '<span class="edited-indicator">(düzenlendi)</span>' : '';
                item.innerHTML = `<div class="message-bubble ${isImageMessage ? 'image-only' : ''}"><span class="username">${data.username}</span><span class="message-text">${messageContent}</span> ${editedIndicator}</div>`;
                if (data.username === currentUsername && !isImageMessage && !data.is_deleted) { // Silinmişse buton ekleme
                    const actionsDiv = document.createElement('div'); actionsDiv.classList.add('message-actions');
                    actionsDiv.innerHTML = `<button class="edit-btn" title="Düzenle">✏️</button><button class="delete-btn" title="Sil">🗑️</button>`;
                    item.appendChild(actionsDiv);
                }
            }
        } else if (type === 'notification') {
            item.classList.add('notification'); item.textContent = data.text;
        } else if (type === 'private-message') {
            item.classList.add('private-message');
            if (data.from) item.innerHTML = `<span class="pm-direction">[<span class="pm-user">${data.from}</span>'dan fısıltı]</span> ${data.message}`;
            else if (data.to) item.innerHTML = `<span class="pm-direction">[<span class="pm-user">${data.to}</span>'e fısıltı]</span> ${data.message}`;
        }
        messages.appendChild(item); messages.scrollTop = messages.scrollHeight;
    }
    socket.on('load history', (history) => { messages.innerHTML = ''; history.forEach(msg => { addMessage(msg, 'message'); }); addMessage({ text: '--- Mesaj geçmişi yüklendi ---' }, 'notification'); });
    socket.on('message deleted', (data) => { const { messageId } = data; const messageItem = messages.querySelector(`li[data-message-id="${messageId}"]`); if (messageItem) { messageItem.classList.add('deleted-message'); messageItem.innerHTML = '[Mesaj silindi]'; } });
    socket.on('message edited', (data) => { const { messageId, newMessage, editedAt } = data; const messageItem = messages.querySelector(`li[data-message-id="${messageId}"]`); if (messageItem && !messageItem.classList.contains('deleted-message')) { const messageTextElement = messageItem.querySelector('.message-text'); const editedIndicatorElement = messageItem.querySelector('.edited-indicator'); if (messageTextElement) { messageTextElement.textContent = newMessage; } if (!editedIndicatorElement) { const indicator = document.createElement('span'); indicator.classList.add('edited-indicator'); indicator.textContent = '(düzenlendi)'; messageItem.querySelector('.message-bubble').appendChild(indicator); } } });
    socket.on('chat message', (data) => addMessage(data, 'message'));
    socket.on('user joined', (username) => addMessage({ text: username + ' odaya katıldı.' }, 'notification'));
    socket.on('user left', (username) => addMessage({ text: username + ' odadan ayrıldı.' }, 'notification'));
    socket.on('notification', (data) => addMessage({ text: data.text }, 'notification'));
    socket.on('private message', (data) => addMessage(data, 'private-message'));
    socket.on('update user list', (users) => {
        userList.innerHTML = '';
        users.forEach(username => {
            const item = document.createElement('li'); item.classList.add('user');
            const indicator = document.createElement('span'); indicator.classList.add('online-indicator');
            const nameText = document.createTextNode(username);
            item.appendChild(indicator); item.appendChild(nameText);
            userList.appendChild(item);
        });
    });
    socket.on('user typing', (username) => { usersTyping[username] = true; updateTypingNotification(); });
    socket.on('stop typing', (username) => { delete usersTyping[username]; updateTypingNotification(); });
    socket.on('disconnect', (reason) => { console.log('Socket bağlantısı kesildi:', reason); });
    socket.on('connect_error', (err) => { console.error('Socket bağlantı hatası:', err.message); if (authContainer.style.display === 'none' && roomSelectionContainer.style.display === 'none') { showScreen(authContainer); } });
}

// --- 5. KISIM: Diğer Arayüz Mantığı ---
menuToggle.addEventListener('click', () => { sidebar.classList.toggle('sidebar-visible'); });
let usersTyping = {};
function updateTypingNotification() { const names = Object.keys(usersTyping); if (names.length === 0) typingNotification.textContent = ''; else if (names.length === 1) typingNotification.textContent = names[0] + ' yazıyor...'; else typingNotification.textContent = names.join(' ve ') + ' yazıyor...'; }
function clearChatUI(clearRoomName = true) { if(clearRoomName) roomNameDisplay.textContent = '...'; userList.innerHTML = ''; messages.innerHTML = ''; typingNotification.textContent = ''; sidebar.classList.remove('sidebar-visible'); }
messageForm.addEventListener('submit', (e) => { e.preventDefault(); if (messageInput.value && socket) { socket.emit('chat message', messageInput.value); socket.emit('stop typing'); messageInput.value = ''; } });
fileInput.addEventListener('change', () => { const file = fileInput.files[0]; if (!file) return; const formData = new FormData(); formData.append('image', file); fetch('/upload', { method: 'POST', body: formData }).then(response => { if (!response.ok) return response.json().then(data => { throw new Error(data.error); }); return response.json(); }).then(data => { if(socket) socket.emit('chat message', data.imageUrl); }).catch(error => { addMessage({ text: `Hata: ${error.message}` }, 'notification'); }); fileInput.value = null; });
messages.addEventListener('click', (e) => {
    if (e.target && e.target.classList.contains('delete-btn')) {
        const messageItem = e.target.closest('li[data-message-id]');
        if (messageItem && socket) { const messageId = messageItem.dataset.messageId; if (confirm('Bu mesajı silmek istediğinizden emin misiniz?')) { socket.emit('delete message', messageId); } }
    } else if (e.target && e.target.classList.contains('edit-btn')) {
        const messageItem = e.target.closest('li[data-message-id]');
        if (messageItem && socket) { const messageId = messageItem.dataset.messageId; const messageTextElement = messageItem.querySelector('.message-text'); const currentMessage = messageTextElement ? messageTextElement.textContent : ''; const newMessage = prompt('Mesajınızı düzenleyin:', currentMessage); if (newMessage !== null && newMessage.trim() !== currentMessage) { socket.emit('edit message', { messageId, newMessage: newMessage.trim() }); } } // trim() eklendi
    }
});
userList.addEventListener('click', (e) => { if (e.target && e.target.matches('li.user')) { const nameElement = e.target.childNodes.length > 1 ? e.target.childNodes[1] : e.target; const targetUsername = nameElement.textContent.trim(); if (targetUsername !== currentUsername && socket) { const message = prompt(`Kime: ${targetUsername} - Fısıltınız:`); if (message) socket.emit('private message', { to: targetUsername, message: message }); } } }); // Kullanıcı adı alımı düzeltildi


// --- UYGULAMAYI BAŞLAT ---
document.addEventListener('DOMContentLoaded', checkAuthOnLoad);