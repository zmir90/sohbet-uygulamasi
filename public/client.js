// === client.js - NİHAİ v23 - Token Auth KALDIRILDI ===

let socket = null; let currentUsername = ''; let usersTyping = {}; let typingTimer; const typingTimeout = 1500;
let authContainer, loginFormContainer, registerFormContainer, loginForm, registerForm, loginUsernameInput, loginPasswordInput, registerUsernameInput, registerPasswordInput, loginErrorEl, registerErrorEl, registerSuccessEl, showRegisterLink, showLoginLink, roomSelectionContainer, roomForm, roomInput, logoutButtonRoom, chatContainer, sidebar, menuToggle, logoutButtonChat, roomNameDisplay, userList, messages, typingNotification, messageForm, messageInput, fileInput;

// Yardımcı Fonksiyonlar (Aynı)
function showError(element, message) { /*...*/ } function clearErrors() { /*...*/ } function showScreen(screenToShow) { /*...*/ } function clearChatUI(clearRoomName = true) { /*...*/ }

// Kimlik Doğrulama Mantığı (Token KAYDETME/TEMİZLEME kaldırıldı)
function handleRegisterSubmit(e) { /* ... içerik aynı ... */ }
function handleLoginSubmit(e) {
    e.preventDefault(); console.log("[Auth] Login submit"); clearErrors();
    const username = loginUsernameInput.value; const password = loginPasswordInput.value;
    fetch('/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }), })
    .then(response => response.json().then(data => ({ ok: response.ok, data })))
    .then(({ ok, data }) => {
        if (!ok) throw new Error(data.error || 'Giriş başarısız.');
        currentUsername = data.user.username; // Sadece username'i sakla
        showScreen(roomSelectionContainer);
        initializeSocket(); // Socket'i BAŞLAT
    })
    .catch(error => { console.error("[Auth] Login Error:", error); showError(loginErrorEl, error.message); });
}
async function handleLogout() { if (socket) { socket.disconnect(); socket = null; } /* authToken = null; kaldırıldı */ try { await fetch('/logout', { method: 'POST' }); } catch (error) { console.error('Çıkış hatası:', error); } finally { currentUsername = ''; clearChatUI(); showScreen(authContainer); } }
async function checkAuthOnLoad() { try { console.log("Checking auth..."); const response = await fetch('/check-auth'); const data = await response.json(); console.log("Auth check:", data); if (data.loggedIn) { currentUsername = data.user.username; /* authToken = data.token; kaldırıldı */ showScreen(roomSelectionContainer); initializeSocket(); } else { /* authToken = null; kaldırıldı */ showScreen(authContainer); } } catch (error) { console.error('Oturum kontrol hatası:', error); /* authToken = null; kaldırıldı */ showScreen(authContainer); } }

// Socket.IO ve Sohbet Mantığı
function initializeSocket() {
    if (socket) { console.log("Socket already initialized."); return; }
    // if (!authToken) { ... } kontrolü kaldırıldı
    console.log("--> initializeSocket() called. Connecting (withCredentials)...");

    // Token gönderme kaldırıldı, çerezlere güveniyoruz
    socket = io({
        withCredentials: true // Çerezleri göndermesi için BU ÖNEMLİ!
    });

    // Bağlantı Olayları (Aynı)
    socket.on("connect", () => { console.log("✅ Socket CONNECTED! ID:", socket.id); /* ... */ });
    socket.on("disconnect", (reason) => { console.warn("❌ Socket DISCONNECTED! Reason:", reason); });
    socket.on("connect_error", (err) => { console.error("❌ Socket CONNECT_ERROR:", err.message, err.cause || ''); });

    // Oda Katılma Formu (Aynı)
    roomForm.addEventListener('submit', (e) => { /* ... */ });
    // Diğer Socket Dinleyicileri (Aynı)
    socket.on('room joined', (roomName) => { /* ... */ });
    socket.on('load history', (history) => { /* ... */ });
    // ... (diğer tüm socket.on olayları aynı) ...

    console.log("Socket initialized and listeners added (Cookie Auth).");
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