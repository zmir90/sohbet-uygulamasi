// === SEVİYE 30.2 - GÜNCELLENMİŞ client.js (Beyaz Tahta Çizim Mantığı) ===

let socket = null;
let currentUsername = '';
let usersTyping = {};
let typingTimer;
const typingTimeout = 1500;

// HTML Elemanları
let authContainer, loginFormContainer, registerFormContainer, loginForm, registerForm,
    loginUsernameInput, loginPasswordInput, registerUsernameInput, registerPasswordInput,
    loginErrorEl, registerErrorEl, registerSuccessEl, showRegisterLink, showLoginLink,
    roomSelectionContainer, roomForm, roomInput, logoutButtonRoom, chatContainer, sidebar,
    menuToggle, logoutButtonChat, roomNameDisplay, userList, messages, typingNotification,
    messageForm, messageInput, fileInput,
    // --- YENİ EKLENDİ: Beyaz Tahta Elementleri ---
    whiteboardContainer, whiteboard, ctx, colorControls, clearButton;

let drawing = false; // Çizim yapıyor muyuz?
let currentColor = 'black'; // Başlangıç rengi
let lastX = 0;
let lastY = 0;
// ------------------------------------------

// Yardımcı Fonksiyonlar (Aynı)
function showError(element, message) { /*...*/ }
function clearErrors() { /*...*/ }
function showScreen(screenToShow) { /*...*/ }
function clearChatUI(clearRoomName = true) { /*...*/ }
// Tam kodlar:
function showError(element, message) { if (element) element.textContent = message; }
function clearErrors() { if (loginErrorEl) loginErrorEl.textContent = ''; if (registerErrorEl) registerErrorEl.textContent = ''; if (registerSuccessEl) registerSuccessEl.textContent = ''; }
function showScreen(screenToShow) { if (authContainer) authContainer.style.display = 'none'; if (roomSelectionContainer) roomSelectionContainer.style.display = 'none'; if (chatContainer) chatContainer.style.display = 'none'; if (screenToShow) { screenToShow.style.display = 'block'; if (screenToShow === chatContainer) screenToShow.style.display = 'flex'; } else { if (authContainer) authContainer.style.display = 'block'; } }
function clearChatUI(clearRoomName = true) { if(clearRoomName && roomNameDisplay) roomNameDisplay.textContent = '...'; if (userList) userList.innerHTML = ''; if (messages) messages.innerHTML = ''; if (typingNotification) typingNotification.textContent = ''; if (sidebar) sidebar.classList.remove('sidebar-visible'); /* YENİ: Canvas'ı da temizle */ if (ctx) ctx.clearRect(0, 0, whiteboard.width, whiteboard.height);}

// Kimlik Doğrulama Mantığı (Aynı)
function handleRegisterSubmit(e) { /*...*/ }
function handleLoginSubmit(e) { /*...*/ }
async function handleLogout() { /*...*/ }
async function checkAuthOnLoad() { /*...*/ }
// Tam kodlar:
function handleRegisterSubmit(e) { e.preventDefault(); console.log("[Auth] Register submit"); clearErrors(); const username = registerUsernameInput.value; const password = registerPasswordInput.value; fetch('/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }), }).then(response => response.json().then(data => ({ ok: response.ok, data }))).then(({ ok, data }) => { if (!ok) throw new Error(data.error || 'Kayıt başarısız.'); registerSuccessEl.textContent = data.message + ' Giriş yapın.'; registerForm.reset(); setTimeout(() => { if(showLoginLink) showLoginLink.click(); }, 1500); }).catch(error => { console.error("[Auth] Register Error:", error); showError(registerErrorEl, error.message); }); }
function handleLoginSubmit(e) { e.preventDefault(); console.log("[Auth] Login submit"); clearErrors(); const username = loginUsernameInput.value; const password = loginPasswordInput.value; fetch('/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }), }).then(response => response.json().then(data => ({ ok: response.ok, data }))).then(({ ok, data }) => { if (!ok) throw new Error(data.error || 'Giriş başarısız.'); currentUsername = data.user.username; showScreen(roomSelectionContainer); initializeSocket(); }).catch(error => { console.error("[Auth] Login Error:", error); showError(loginErrorEl, error.message); }); }
async function handleLogout() { if (socket) { socket.disconnect(); socket = null; } try { await fetch('/logout', { method: 'POST' }); } catch (error) { console.error('Çıkış hatası:', error); } finally { currentUsername = ''; clearChatUI(); showScreen(authContainer); } }
async function checkAuthOnLoad() { try { console.log("Checking auth..."); const response = await fetch('/check-auth'); const data = await response.json(); console.log("Auth check:", data); if (data.loggedIn) { currentUsername = data.user.username; showScreen(roomSelectionContainer); initializeSocket(); } else { showScreen(authContainer); } } catch (error) { console.error('Oturum kontrol hatası:', error); showScreen(authContainer); } }


// Socket.IO ve Sohbet Mantığı
function initializeSocket() {
    if (socket) return;
    console.log("--> initializeSocket() called...");
    socket = io({ withCredentials: true });

    // Bağlantı Olayları
    socket.on("connect", () => {
        console.log("✅ Socket CONNECTED! ID:", socket.id);
        // Otomatik join'i şimdilik kaldıralım, oda formuyla yapsın
        // if (roomSelectionContainer.style.display === 'block' && roomInput.value) { /* ... */ }
    });
    socket.on("disconnect", (reason) => { console.warn("❌ Socket DISCONNECTED! Reason:", reason); });
    socket.on("connect_error", (err) => { console.error("❌ Socket CONNECT_ERROR:", err.message, err.cause || ''); });

    // Oda Katılma Formu
    roomForm.addEventListener('submit', (e) => {
        e.preventDefault(); const room = roomInput.value;
        if (room && socket && socket.connected) {
             console.log(`--> Joining room '${room}'...`);
             socket.emit('join chat', { room }); // Sunucuya katılma isteği
             showScreen(chatContainer);
             messageInput.focus();
             // YENİ: Odaya girince beyaz tahta ayarlarını yap
             setupWhiteboard();
        } else { console.error("Cannot join room!"); }
    });

    // --- YENİ EKLENDİ: Beyaz Tahta Olay Dinleyicisi ---
    socket.on('draw line', (data) => {
        // Sunucudan (başka bir kullanıcıdan) çizim verisi geldi
        // console.log("Received draw data:", data); // Çok fazla log üretebilir
        drawLineOnCanvas(data.x1, data.y1, data.x2, data.y2, data.color);
    });
    // YENİ: Tahtayı temizle komutu
    socket.on('clear board', () => {
        if(ctx) {
            ctx.clearRect(0, 0, whiteboard.width, whiteboard.height);
            console.log("Board cleared by another user.");
        }
    });
    // --- BİTTİ: Beyaz Tahta Dinleyicileri ---


    // Diğer Socket Dinleyicileri (Aynı)
    socket.on('room joined', (roomName) => { console.log(`✅ Joined room: ${roomName}`); if (roomNameDisplay) roomNameDisplay.textContent = roomName; clearChatUI(false); });
    socket.on('load history', (history) => { /*...*/ });
    socket.on('message deleted', (data) => { /*...*/ });
    socket.on('message edited', (data) => { /*...*/ });
    socket.on('chat message', (data) => addMessage(data, 'message'));
    socket.on('user joined', (username) => { /*...*/ });
    socket.on('user left', (username) => { /*...*/ });
    socket.on('notification', (data) => { /*...*/ });
    socket.on('private message', (data) => { /*...*/ });
    socket.on('update user list', (users) => { /*...*/ });
    socket.on('user typing', (username) => { /*...*/ });
    socket.on('stop typing', (username) => { /*...*/ });

    console.log("Socket initialized.");
} // initializeSocket bitişi

function addMessage(data, type) { /* ... içerik aynı ... */ }
function updateTypingNotification() { /* ... içerik aynı ... */ }


// --- YENİ EKLENDİ: BEYAZ TAHTA FONKSİYONLARI ---

// Canvas ve olay dinleyicilerini ayarla (sadece odaya girince çağrılır)
function setupWhiteboard() {
    if (!whiteboard || !ctx) { // Sadece ilk kez ayarla
        whiteboard = document.getElementById('whiteboard');
        colorControls = document.getElementById('color-controls');
        clearButton = document.querySelector('.clear-btn');

        if (!whiteboard || !colorControls || !clearButton) {
            console.error("Beyaz tahta elementleri bulunamadı!");
            return;
        }
        ctx = whiteboard.getContext('2d');
        if (!ctx) {
             console.error("Canvas context alınamadı!");
            return;
        }

        // Canvas boyutunu ayarlayalım (CSS yerine buradan yapmak daha güvenli)
        // const container = document.getElementById('whiteboard-container');
        // whiteboard.width = container.offsetWidth - 2; // Kenarlık payı
        // whiteboard.height = 250; // Sabit yükseklik
        // Şimdilik HTML'deki boyutları kullanalım (width="500" height="300")

        ctx.lineWidth = 2; // Çizgi kalınlığı
        ctx.lineCap = 'round'; // Çizgi uçları yuvarlak

        // Fare olayları
        whiteboard.addEventListener('mousedown', startDrawing);
        whiteboard.addEventListener('mousemove', draw);
        whiteboard.addEventListener('mouseup', stopDrawing);
        whiteboard.addEventListener('mouseout', stopDrawing); // Fare tuvalden çıkarsa

        // Dokunmatik olayları (mobil için)
        whiteboard.addEventListener('touchstart', startDrawing);
        whiteboard.addEventListener('touchmove', draw);
        whiteboard.addEventListener('touchend', stopDrawing);

        // Renk butonu olayları
        colorControls.addEventListener('click', changeColor);
        // Başlangıç rengini seçili yap
        const initialColorBtn = colorControls.querySelector(`[data-color="${currentColor}"]`);
        if (initialColorBtn) initialColorBtn.classList.add('selected');


        // Temizle butonu olayı
        clearButton.addEventListener('click', clearBoard);

        console.log("Beyaz tahta ayarlandı.");
    } else {
        // Odaya tekrar girildiyse sadece temizle
        ctx.clearRect(0, 0, whiteboard.width, whiteboard.height);
         console.log("Beyaz tahta temizlendi (tekrar giris).");
    }
}

// Çizimi başlatan fonksiyon (fare basılı / dokunma başladı)
function startDrawing(e) {
    if (!ctx) return;
    drawing = true;
    const { x, y } = getMousePos(e);
    [lastX, lastY] = [x, y];
    // console.log("Start drawing at:", x, y); // DEBUG
}

// Çizimi yapan fonksiyon (fare hareket etti / parmak kaydırıldı)
function draw(e) {
    if (!drawing || !ctx || !socket) return;
    e.preventDefault(); // Mobilde sayfanın kaymasını engelle
    const { x, y } = getMousePos(e);

    // Kendi ekranımıza çiz
    drawLineOnCanvas(lastX, lastY, x, y, currentColor);

    // Çizim verisini sunucuya gönder (sadece anlamlı hareket varsa)
    if (Math.abs(lastX - x) > 1 || Math.abs(lastY - y) > 1) {
        socket.emit('draw line', {
            x1: lastX, y1: lastY,
            x2: x, y2: y,
            color: currentColor
        });
    }

    [lastX, lastY] = [x, y];
}

// Çizimi bitiren fonksiyon (fare bırakıldı / dokunma bitti)
function stopDrawing() {
    if (drawing) {
        // console.log("Stop drawing"); // DEBUG
        drawing = false;
    }
}

// Fare veya dokunma koordinatlarını canvas'a göre hesapla
function getMousePos(e) {
    const rect = whiteboard.getBoundingClientRect();
    let x, y;
    if (e.touches && e.touches[0]) { // Dokunmatik
        x = e.touches[0].clientX - rect.left;
        y = e.touches[0].clientY - rect.top;
    } else { // Fare
        x = e.clientX - rect.left;
        y = e.clientY - rect.top;
    }
    return { x, y };
}

// Belirtilen koordinatlar arasına çizgi çizen fonksiyon
function drawLineOnCanvas(x1, y1, x2, y2, color) {
    if (!ctx) return;
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
}

// Renk değiştirme fonksiyonu
function changeColor(e) {
    if (e.target && e.target.classList.contains('color-btn')) {
        // Önceki seçimi kaldır
        const selectedBtn = colorControls.querySelector('.selected');
        if (selectedBtn) selectedBtn.classList.remove('selected');
        // Yeni rengi ayarla ve butonu seçili yap
        currentColor = e.target.dataset.color;
        e.target.classList.add('selected');
        console.log("Color changed to:", currentColor); // DEBUG
    }
}

// Tahtayı temizleme fonksiyonu
function clearBoard() {
    if (!ctx || !socket) return;
    if (confirm("Tahtayı herkes için temizlemek istediğinizden emin misiniz?")) {
        // Kendi ekranımızı temizle
        ctx.clearRect(0, 0, whiteboard.width, whiteboard.height);
        // Sunucuya temizleme komutunu gönder
        socket.emit('clear board');
        console.log("Board cleared locally and event emitted."); // DEBUG
    }
}

// --- BİTTİ: BEYAZ TAHTA FONKSİYONLARI ---


// --- 5. KISIM: Diğer Arayüz Mantığı (Aynı) ---
menuToggle.addEventListener('click', () => { /*...*/ });
function clearChatUI(clearRoomName = true) { /*...*/ }
messageForm.addEventListener('submit', (e) => { /*...*/ });
fileInput.addEventListener('change', () => { /*...*/ });
messages.addEventListener('click', (e) => { /*...*/ });
userList.addEventListener('click', (e) => { /*...*/ });
messageInput.addEventListener('keyup', () => { /*...*/ });
// Tam kodlar:
menuToggle.addEventListener('click', () => { if(sidebar) sidebar.classList.toggle('sidebar-visible'); });
// clearChatUI yukarıda güncellendi
messageForm.addEventListener('submit', (e) => { e.preventDefault(); if (messageInput.value && socket) { socket.emit('chat message', messageInput.value); socket.emit('stop typing'); messageInput.value = ''; } });
fileInput.addEventListener('change', () => { const file = fileInput.files[0]; if (!file) return; const formData = new FormData(); formData.append('image', file); fetch('/upload', { method: 'POST', body: formData }).then(response => { if (!response.ok) return response.json().then(data => { throw new Error(data.error); }); return response.json(); }).then(data => { if(socket) socket.emit('chat message', data.imageUrl); }).catch(error => { addMessage({ text: `Hata: ${error.message}` }, 'notification'); }); fileInput.value = null; });
messages.addEventListener('click', (e) => { if (e.target && e.target.classList.contains('delete-btn')) { const messageItem = e.target.closest('li[data-message-id]'); if (messageItem && socket) { const messageId = messageItem.dataset.messageId; if (confirm('Mesajı sil?')) { socket.emit('delete message', messageId); } } } else if (e.target && e.target.classList.contains('edit-btn')) { const messageItem = e.target.closest('li[data-message-id]'); if (messageItem && socket) { const messageId = messageItem.dataset.messageId; const messageTextElement = messageItem.querySelector('.message-text'); const currentMessage = messageTextElement ? messageTextElement.textContent : ''; const newMessage = prompt('Yeni mesaj:', currentMessage); if (newMessage !== null && newMessage.trim() !== currentMessage) { socket.emit('edit message', { messageId, newMessage: newMessage.trim() }); } } } });
userList.addEventListener('click', (e) => { if (e.target && e.target.matches('li.user')) { const nameElement = e.target.childNodes.length > 1 ? e.target.childNodes[1] : e.target; const targetUsername = nameElement.textContent.trim(); if (targetUsername !== currentUsername && socket) { const message = prompt(`Kime: ${targetUsername} - Fısıltı:`); if (message) socket.emit('private message', { to: targetUsername, message: message }); } } });
messageInput.addEventListener('keyup', () => { if(socket) socket.emit('typing'); clearTimeout(typingTimer); typingTimer = setTimeout(() => { if(socket) socket.emit('stop typing'); }, typingTimeout); });


// --- UYGULAMAYI BAŞLAT ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM loaded.");
    // HTML Elemanlarını seç
    authContainer = document.getElementById('auth-container'); loginFormContainer = document.getElementById('login-form-container'); registerFormContainer = document.getElementById('register-form-container'); loginForm = document.getElementById('login-form'); registerForm = document.getElementById('register-form'); loginUsernameInput = document.getElementById('login-username'); loginPasswordInput = document.getElementById('login-password'); registerUsernameInput = document.getElementById('register-username'); registerPasswordInput = document.getElementById('register-password'); loginErrorEl = document.getElementById('login-error'); registerErrorEl = document.getElementById('register-error'); registerSuccessEl = document.getElementById('register-success'); showRegisterLink = document.getElementById('show-register'); showLoginLink = document.getElementById('show-login'); roomSelectionContainer = document.getElementById('room-selection-container'); roomForm = document.getElementById('room-form'); roomInput = document.getElementById('room-input'); logoutButtonRoom = document.getElementById('logout-button-room'); chatContainer = document.getElementById('chat-container'); sidebar = document.getElementById('sidebar'); menuToggle = document.getElementById('menu-toggle'); logoutButtonChat = document.getElementById('logout-button-chat'); roomNameDisplay = document.getElementById('room-name'); userList = document.getElementById('user-list'); messages = document.getElementById('messages'); typingNotification = document.getElementById('typing-notification'); messageForm = document.getElementById('form'); messageInput = document.getElementById('input'); fileInput = document.getElementById('file-input');
    // Beyaz tahta elementlerini de burada seçelim (ama setupWhiteboard içinde tekrar kontrol edilecek)
    whiteboardContainer = document.getElementById('whiteboard-container');
    whiteboard = document.getElementById('whiteboard');
    colorControls = document.getElementById('color-controls');
    clearButton = document.querySelector('#whiteboard-container .clear-btn'); // Daha spesifik seçici


    // Elementlerin varlığını kontrol et
    if (!loginForm || !registerForm || !messageForm || !authContainer || !roomSelectionContainer || !chatContainer || !showRegisterLink || !showLoginLink ) { console.error("HATA: Gerekli elementler bulunamadı!"); alert("Uygulama yüklenirken hata oluştu."); return; }
    console.log("Elements selected.");
    // Olay dinleyicilerini ekle
    showRegisterLink.addEventListener('click', (e) => { e.preventDefault(); clearErrors(); loginFormContainer.style.display = 'none'; registerFormContainer.style.display = 'block'; });
    showLoginLink.addEventListener('click', (e) => { e.preventDefault(); clearErrors(); registerFormContainer.style.display = 'none'; loginFormContainer.style.display = 'block'; });
    registerForm.addEventListener('submit', handleRegisterSubmit);
    loginForm.addEventListener('submit', handleLoginSubmit);
    logoutButtonRoom.addEventListener('click', handleLogout);
    logoutButtonChat.addEventListener('click', handleLogout);
    menuToggle.addEventListener('click', () => { if(sidebar) sidebar.classList.toggle('sidebar-visible'); });
    messageForm.addEventListener('submit', (e) => { /* ... */ });
    fileInput.addEventListener('change', () => { /* ... */ });
    messages.addEventListener('click', (e) => { /* ... */ });
    userList.addEventListener('click', (e) => { /* ... */ });
    messageInput.addEventListener('keyup', () => { /* ... */ });

    console.log("Event listeners added.");
    checkAuthOnLoad();
});