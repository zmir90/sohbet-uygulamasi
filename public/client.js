// === NİHAİ DÜZELTME v8 - client.js (DOM Yüklenmesini Bekle) ===

// Global değişkenler
let socket = null;
let currentUsername = '';
let usersTyping = {};
let typingTimer;
const typingTimeout = 1500;

// --- 1. KISIM: HTML Elemanlarını Seçme ---
// Bu değişkenler sayfa yüklendikten sonra doldurulacak
let authContainer, loginFormContainer, registerFormContainer, loginForm, registerForm,
    loginUsernameInput, loginPasswordInput, registerUsernameInput, registerPasswordInput,
    loginErrorEl, registerErrorEl, registerSuccessEl, showRegisterLink, showLoginLink,
    roomSelectionContainer, roomForm, roomInput, logoutButtonRoom, chatContainer, sidebar,
    menuToggle, logoutButtonChat, roomNameDisplay, userList, messages, typingNotification,
    messageForm, messageInput, fileInput;

// --- 2. KISIM: Yardımcı Fonksiyonlar ---
function showError(element, message) { if (element) element.textContent = message; }
function clearErrors() { if (loginErrorEl) loginErrorEl.textContent = ''; if (registerErrorEl) registerErrorEl.textContent = ''; if (registerSuccessEl) registerSuccessEl.textContent = ''; }
function showScreen(screenToShow) {
    if (authContainer) authContainer.style.display = 'none';
    if (roomSelectionContainer) roomSelectionContainer.style.display = 'none';
    if (chatContainer) chatContainer.style.display = 'none';
    if (screenToShow) {
        screenToShow.style.display = 'block';
        if (screenToShow === chatContainer) screenToShow.style.display = 'flex';
    } else {
        // Eğer gösterilecek ekran bulunamazsa (hata durumu), auth ekranını göster
        if (authContainer) authContainer.style.display = 'block';
    }
}
function clearChatUI(clearRoomName = true) {
    if (clearRoomName && roomNameDisplay) roomNameDisplay.textContent = '...';
    if (userList) userList.innerHTML = '';
    if (messages) messages.innerHTML = '';
    if (typingNotification) typingNotification.textContent = '';
    if (sidebar) sidebar.classList.remove('sidebar-visible');
}

// --- 3. KISIM: Kimlik Doğrulama (Auth) Mantığı ---
async function handleRegisterSubmit(e) {
    e.preventDefault(); console.log("Register submit triggered"); // DEBUG
    clearErrors();
    const username = registerUsernameInput.value;
    const password = registerPasswordInput.value;
    try {
        const response = await fetch('/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }), });
        const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Kayıt başarısız.');
        registerSuccessEl.textContent = data.message + ' Şimdi giriş yapabilirsiniz.'; registerForm.reset();
        setTimeout(() => { if(showLoginLink) showLoginLink.click(); }, 1500);
    } catch (error) { console.error("Register Error:", error.message); showError(registerErrorEl, error.message); }
}
async function handleLoginSubmit(e) {
    e.preventDefault(); console.log("Login submit triggered"); // DEBUG
    clearErrors();
    const username = loginUsernameInput.value;
    const password = loginPasswordInput.value;
    try {
        const response = await fetch('/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }), });
        const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Giriş başarısız.');
        currentUsername = data.user.username; showScreen(roomSelectionContainer); initializeSocket();
    } catch (error) { console.error("Login Error:", error.message); showError(loginErrorEl, error.message); }
}
async function handleLogout() {
     if (socket) { socket.disconnect(); socket = null; }
    try { await fetch('/logout', { method: 'POST' }); }
    catch (error) { console.error('Çıkış hatası:', error); }
    finally { currentUsername = ''; clearChatUI(); showScreen(authContainer); }
}
async function checkAuthOnLoad() {
    try {
        console.log("Checking auth status on load..."); // DEBUG
        const response = await fetch('/check-auth'); const data = await response.json();
        console.log("Auth check response:", data); // DEBUG
        if (data.loggedIn) { currentUsername = data.user.username; showScreen(roomSelectionContainer); initializeSocket(); }
        else { showScreen(authContainer); }
    } catch (error) { console.error('Oturum kontrol hatası:', error); showScreen(authContainer); }
}

// --- 4. KISIM: Socket.IO ve Sohbet Mantığı ---
function initializeSocket() {
    if (socket) return;
    console.log("Initializing Socket.IO connection..."); // DEBUG
    socket = io();

    // Socket Olay Dinleyicileri (hemen eklenebilir)
    socket.on('room joined', (roomName) => { if (roomNameDisplay) roomNameDisplay.textContent = roomName; clearChatUI(false); });
    socket.on('load history', (history) => { if (messages) messages.innerHTML = ''; history.forEach(msg => { addMessage(msg, 'message'); }); addMessage({ text: '--- Mesaj geçmişi yüklendi ---' }, 'notification'); });
    socket.on('message deleted', (data) => { const { messageId } = data; const messageItem = messages?.querySelector(`li[data-message-id="${messageId}"]`); if (messageItem) { messageItem.classList.add('deleted-message'); messageItem.innerHTML = '[Mesaj silindi]'; } });
    socket.on('message edited', (data) => { const { messageId, newMessage, editedAt } = data; const messageItem = messages?.querySelector(`li[data-message-id="${messageId}"]`); if (messageItem && !messageItem.classList.contains('deleted-message')) { const messageTextElement = messageItem.querySelector('.message-text'); const editedIndicatorElement = messageItem.querySelector('.edited-indicator'); if (messageTextElement) { messageTextElement.textContent = newMessage; } if (!editedIndicatorElement) { const indicator = document.createElement('span'); indicator.classList.add('edited-indicator'); indicator.textContent = '(düzenlendi)'; messageItem.querySelector('.message-bubble').appendChild(indicator); } } });
    socket.on('chat message', (data) => addMessage(data, 'message'));
    socket.on('user joined', (username) => addMessage({ text: username + ' odaya katıldı.' }, 'notification'));
    socket.on('user left', (username) => addMessage({ text: username + ' odadan ayrıldı.' }, 'notification'));
    socket.on('notification', (data) => addMessage({ text: data.text }, 'notification'));
    socket.on('private message', (data) => addMessage(data, 'private-message'));
    socket.on('update user list', (users) => {
        if (!userList) return; userList.innerHTML = '';
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

    console.log("Socket.IO connection established and listeners added."); // DEBUG
}
function addMessage(data, type) {
    if (!messages) return; // messages elementi henüz yoksa çık
    const item = document.createElement('li'); if (data.id) item.dataset.messageId = data.id;
    if (type === 'message') { if (data.username === currentUsername) item.classList.add('sent'); else item.classList.add('received'); if (data.is_deleted) { item.classList.add('deleted-message'); item.innerHTML = `[Mesaj silindi]`; } else { const isImageMessage = data.message.startsWith('https://res.cloudinary.com/'); let messageContent = ''; if (isImageMessage) messageContent = `<img src="${data.message}" alt="Yüklenen Resim">`; else messageContent = data.message; const editedIndicator = data.edited_at ? '<span class="edited-indicator">(düzenlendi)</span>' : ''; item.innerHTML = `<div class="message-bubble ${isImageMessage ? 'image-only' : ''}"><span class="username">${data.username}</span><span class="message-text">${messageContent}</span> ${editedIndicator}</div>`; if (data.username === currentUsername && !isImageMessage && !data.is_deleted) { const actionsDiv = document.createElement('div'); actionsDiv.classList.add('message-actions'); actionsDiv.innerHTML = `<button class="edit-btn" title="Düzenle">✏️</button><button class="delete-btn" title="Sil">🗑️</button>`; item.appendChild(actionsDiv); } } }
    else if (type === 'notification') { item.classList.add('notification'); item.textContent = data.text; }
    else if (type === 'private-message') { item.classList.add('private-message'); if (data.from) item.innerHTML = `<span class="pm-direction">[<span class="pm-user">${data.from}</span>'dan fısıltı]</span> ${data.message}`; else if (data.to) item.innerHTML = `<span class="pm-direction">[<span class="pm-user">${data.to}</span>'e fısıltı]</span> ${data.message}`; }
    messages.appendChild(item); messages.scrollTop = messages.scrollHeight;
}

// --- 5. KISIM: Diğer Arayüz Mantığı ---
function updateTypingNotification() { const names = Object.keys(usersTyping); if (names.length === 0) typingNotification.textContent = ''; else if (names.length === 1) typingNotification.textContent = names[0] + ' yazıyor...'; else typingNotification.textContent = names.join(' ve ') + ' yazıyor...'; }

// --- UYGULAMAYI BAŞLAT ---
// BU KISIM TÜM KODUN EN SONUNDA ÇALIŞACAK
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed"); // DEBUG

    // HTML Elemanlarını şimdi seçelim
    authContainer = document.getElementById('auth-container');
    loginFormContainer = document.getElementById('login-form-container');
    registerFormContainer = document.getElementById('register-form-container');
    loginForm = document.getElementById('login-form');
    registerForm = document.getElementById('register-form');
    loginUsernameInput = document.getElementById('login-username');
    loginPasswordInput = document.getElementById('login-password');
    registerUsernameInput = document.getElementById('register-username');
    registerPasswordInput = document.getElementById('register-password');
    loginErrorEl = document.getElementById('login-error');
    registerErrorEl = document.getElementById('register-error');
    registerSuccessEl = document.getElementById('register-success');
    showRegisterLink = document.getElementById('show-register');
    showLoginLink = document.getElementById('show-login');
    roomSelectionContainer = document.getElementById('room-selection-container');
    roomForm = document.getElementById('room-form');
    roomInput = document.getElementById('room-input');
    logoutButtonRoom = document.getElementById('logout-button-room');
    chatContainer = document.getElementById('chat-container');
    sidebar = document.getElementById('sidebar');
    menuToggle = document.getElementById('menu-toggle');
    logoutButtonChat = document.getElementById('logout-button-chat');
    roomNameDisplay = document.getElementById('room-name');
    userList = document.getElementById('user-list');
    messages = document.getElementById('messages');
    typingNotification = document.getElementById('typing-notification');
    messageForm = document.getElementById('form');
    messageInput = document.getElementById('input');
    fileInput = document.getElementById('file-input');

    // Elementlerin bulunduğunu kontrol edelim
    if (!loginForm || !registerForm || !messageForm) {
        console.error("HATA: Gerekli form elementleri bulunamadı! HTML'i kontrol edin.");
        return; // Hata varsa devam etme
    }
    console.log("All essential elements selected."); // DEBUG

    // Olay dinleyicilerini ŞİMDİ ekleyelim
    showRegisterLink.addEventListener('click', (e) => { e.preventDefault(); clearErrors(); loginFormContainer.style.display = 'none'; registerFormContainer.style.display = 'block'; });
    showLoginLink.addEventListener('click', (e) => { e.preventDefault(); clearErrors(); registerFormContainer.style.display = 'none'; loginFormContainer.style.display = 'block'; });
    registerForm.addEventListener('submit', handleRegisterSubmit);
    loginForm.addEventListener('submit', handleLoginSubmit);
    logoutButtonRoom.addEventListener('click', handleLogout);
    logoutButtonChat.addEventListener('click', handleLogout);
    menuToggle.addEventListener('click', () => { if(sidebar) sidebar.classList.toggle('sidebar-visible'); });
    messageForm.addEventListener('submit', (e) => { e.preventDefault(); if (messageInput.value && socket) { socket.emit('chat message', messageInput.value); socket.emit('stop typing'); messageInput.value = ''; } });
    fileInput.addEventListener('change', () => { const file = fileInput.files[0]; if (!file) return; const formData = new FormData(); formData.append('image', file); fetch('/upload', { method: 'POST', body: formData }).then(response => { if (!response.ok) return response.json().then(data => { throw new Error(data.error); }); return response.json(); }).then(data => { if(socket) socket.emit('chat message', data.imageUrl); }).catch(error => { addMessage({ text: `Hata: ${error.message}` }, 'notification'); }); fileInput.value = null; });
    messages.addEventListener('click', (e) => { if (e.target && e.target.classList.contains('delete-btn')) { const messageItem = e.target.closest('li[data-message-id]'); if (messageItem && socket) { const messageId = messageItem.dataset.messageId; if (confirm('Bu mesajı silmek istediğinizden emin misiniz?')) { socket.emit('delete message', messageId); } } } else if (e.target && e.target.classList.contains('edit-btn')) { const messageItem = e.target.closest('li[data-message-id]'); if (messageItem && socket) { const messageId = messageItem.dataset.messageId; const messageTextElement = messageItem.querySelector('.message-text'); const currentMessage = messageTextElement ? messageTextElement.textContent : ''; const newMessage = prompt('Mesajınızı düzenleyin:', currentMessage); if (newMessage !== null && newMessage.trim() !== currentMessage) { socket.emit('edit message', { messageId, newMessage: newMessage.trim() }); } } } });
    userList.addEventListener('click', (e) => { if (e.target && e.target.matches('li.user')) { const nameElement = e.target.childNodes.length > 1 ? e.target.childNodes[1] : e.target; const targetUsername = nameElement.textContent.trim(); if (targetUsername !== currentUsername && socket) { const message = prompt(`Kime: ${targetUsername} - Fısıltınız:`); if (message) socket.emit('private message', { to: targetUsername, message: message }); } } });
    messageInput.addEventListener('keyup', () => { if(socket) socket.emit('typing'); clearTimeout(typingTimer); typingTimer = setTimeout(() => { if(socket) socket.emit('stop typing'); }, typingTimeout); }); // Typing listener

    console.log("Event listeners added."); // DEBUG

    // Son olarak, oturum durumunu kontrol et
    checkAuthOnLoad();
});