// === client.js - NİHAİ v20 - SOCKET TOKEN AUTH ===

let socket = null;
let currentUsername = '';
let authToken = null; // YENİ: Token'ı saklamak için
let usersTyping = {};
// ... (diğer global değişkenler aynı) ...
let typingTimer; const typingTimeout = 1500;
let authContainer, loginFormContainer, registerFormContainer, loginForm, registerForm, loginUsernameInput, loginPasswordInput, registerUsernameInput, registerPasswordInput, loginErrorEl, registerErrorEl, registerSuccessEl, showRegisterLink, showLoginLink, roomSelectionContainer, roomForm, roomInput, logoutButtonRoom, chatContainer, sidebar, menuToggle, logoutButtonChat, roomNameDisplay, userList, messages, typingNotification, messageForm, messageInput, fileInput;


// Yardımcı Fonksiyonlar (Aynı)
function showError(element, message) { /*...*/ }
function clearErrors() { /*...*/ }
function showScreen(screenToShow) { /*...*/ }
function clearChatUI(clearRoomName = true) { /*...*/ }

// Kimlik Doğrulama Mantığı (Token'ı kaydedecek şekilde güncellendi)
function handleRegisterSubmit(e) { /* ... içerik aynı ... */ }
function handleLoginSubmit(e) {
    e.preventDefault(); console.log("[Auth] Login submit"); clearErrors();
    const username = loginUsernameInput.value; const password = loginPasswordInput.value;
    console.log("[Auth] Login data:", username);

    fetch('/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }), })
    .then(response => response.json().then(data => ({ ok: response.ok, data })))
    .then(({ ok, data }) => {
        console.log("[Auth] Login response data:", data);
        if (!ok) throw new Error(data.error || 'Giriş başarısız.');
        currentUsername = data.user.username;
        authToken = data.token; // <<<--- YENİ: Token'ı kaydet
        console.log("[Auth] Token received:", authToken); // DEBUG
        showScreen(roomSelectionContainer);
        initializeSocket(); // Socket'i BAŞLAT
    })
    .catch(error => { console.error("[Auth] Login Error:", error); showError(loginErrorEl, error.message); });
}
async function handleLogout() {
     if (socket) { socket.disconnect(); socket = null; }
     authToken = null; // <<<--- YENİ: Token'ı temizle
     try { await fetch('/logout', { method: 'POST' }); }
     catch (error) { console.error('Çıkış hatası:', error); }
     finally { currentUsername = ''; clearChatUI(); showScreen(authContainer); }
 }
async function checkAuthOnLoad() {
    try {
        console.log("Checking auth..."); const response = await fetch('/check-auth'); const data = await response.json(); console.log("Auth check:", data);
        if (data.loggedIn) {
            currentUsername = data.user.username;
            authToken = data.token; // <<<--- YENİ: Token'ı kaydet
            console.log("[Auth] Token received from checkAuth:", authToken); // DEBUG
            showScreen(roomSelectionContainer);
            initializeSocket(); // Socket'i BAŞLAT
        } else {
             authToken = null; // Token'ı temizle
             showScreen(authContainer);
        }
    } catch (error) { console.error('Oturum kontrol hatası:', error); authToken = null; showScreen(authContainer); }
}

// Socket.IO ve Sohbet Mantığı
function initializeSocket() {
    if (socket) { console.log("Socket already initialized."); return; }
    if (!authToken) { // <<<--- YENİ: Token yoksa bağlama!
        console.error("HATA: Socket başlatılamadı - Auth Token yok!");
        return;
    }
    console.log("--> initializeSocket() called. Connecting with Token...");

    // --- DEĞİŞİKLİK BURADA ---
    // Socket.IO'ya token'ı gönder
    socket = io({
        // withCredentials: true, // Token varken buna genellikle gerek kalmaz ama zararı olmaz
        auth: {
            token: authToken // Sakladığımız token'ı gönder
        }
    });
    // --- DEĞİŞİKLİK BİTTİ ---

    // Bağlantı Olayları (Aynı)
    socket.on("connect", () => { console.log("✅ Socket CONNECTED (Token Auth)! ID:", socket.id); /* ... (oda katılma isteği aynı) ... */ });
    socket.on("disconnect", (reason) => { console.warn("❌ Socket DISCONNECTED! Reason:", reason); });
    socket.on("connect_error", (err) => { console.error("❌ Socket CONNECT_ERROR:", err.message, err.cause || ''); });

    // Oda Katılma Formu (Aynı)
    roomForm.addEventListener('submit', (e) => { /* ... */ });

    // Diğer Socket Dinleyicileri (Aynı)
    socket.on('room joined', (roomName) => { /* ... */ });
    socket.on('load history', (history) => { /* ... */ });
    socket.on('message deleted', (data) => { /* ... */ });
    socket.on('message edited', (data) => { /* ... */ });
    socket.on('chat message', (data) => addMessage(data, 'message'));
    socket.on('user joined', (username) => { /* ... */ });
    socket.on('user left', (username) => { /* ... */ });
    socket.on('notification', (data) => { /* ... */ });
    socket.on('private message', (data) => { /* ... */ });
    socket.on('update user list', (users) => { /* ... */ });
    socket.on('user typing', (username) => { /* ... */ });
    socket.on('stop typing', (username) => { /* ... */ });

    console.log("Socket initialized and listeners added (Token Auth).");
}
function addMessage(data, type) { /* ... içerik aynı ... */ }
function updateTypingNotification() { /* ... içerik aynı ... */ }

// --- UYGULAMAYI BAŞLAT ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM loaded.");
    // HTML Elemanlarını seç (Aynı)
    authContainer = document.getElementById('auth-container'); /*...*/
    // ... (diğer elementler) ...
    // Elementlerin varlığını kontrol et (Aynı)
    if (!loginForm || !registerForm /*...*/ ) { /*...*/ return; }
    console.log("Elements selected.");
    // Olay dinleyicilerini ekle (Aynı)
    showRegisterLink.addEventListener('click', (e) => { /*...*/ });
    showLoginLink.addEventListener('click', (e) => { /*...*/ });
    registerForm.addEventListener('submit', handleRegisterSubmit);
    loginForm.addEventListener('submit', handleLoginSubmit);
    logoutButtonRoom.addEventListener('click', handleLogout);
    logoutButtonChat.addEventListener('click', handleLogout);
    menuToggle.addEventListener('click', () => { /*...*/ });
    messageForm.addEventListener('submit', (e) => { /*...*/ });
    fileInput.addEventListener('change', () => { /*...*/ });
    messages.addEventListener('click', (e) => { /*...*/ });
    userList.addEventListener('click', (e) => { /*...*/ });
    messageInput.addEventListener('keyup', () => { /*...*/ });
    console.log("Event listeners added.");
    // Oturum durumunu kontrol et (Aynı)
    checkAuthOnLoad();
});