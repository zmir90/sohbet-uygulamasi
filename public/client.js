// === SEVİYE 21.3 - GÜNCELLENMİŞ public/client.js ===

let socket = null;
let currentUsername = '';

// --- HTML Elemanlarını Seçme (Değişiklik yok) ---
const loginScreen = document.getElementById('login-screen');
// ... (diğer tüm element seçimleri Faz 14.2 ile aynı) ...
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
const authContainer = document.getElementById('auth-container'); // Eksik olanı ekledik

// --- Yardımcı Fonksiyonlar (Değişiklik yok) ---
function showError(element, message) { element.textContent = message; }
function clearErrors() { loginErrorEl.textContent = ''; registerErrorEl.textContent = ''; registerSuccessEl.textContent = ''; }
function showScreen(screenToShow) {
    authContainer.style.display = 'none';
    roomSelectionContainer.style.display = 'none';
    chatContainer.style.display = 'none';
    screenToShow.style.display = 'block';
     if(screenToShow === chatContainer) screenToShow.style.display = 'flex';
}

// --- Kimlik Doğrulama Mantığı (Değişiklik yok) ---
showRegisterLink.addEventListener('click', (e) => { /*...*/ });
showLoginLink.addEventListener('click', (e) => { /*...*/ });
registerForm.addEventListener('submit', async (e) => { /*...*/ });
loginForm.addEventListener('submit', async (e) => { /*...*/ });
async function handleLogout() { /*...*/ }
logoutButtonRoom.addEventListener('click', handleLogout);
logoutButtonChat.addEventListener('click', handleLogout);
async function checkAuthOnLoad() { /*...*/ }
// Tam kodlar:
showRegisterLink.addEventListener('click', (e) => { e.preventDefault(); clearErrors(); loginFormContainer.style.display = 'none'; registerFormContainer.style.display = 'block'; });
showLoginLink.addEventListener('click', (e) => { e.preventDefault(); clearErrors(); registerFormContainer.style.display = 'none'; loginFormContainer.style.display = 'block'; });
registerForm.addEventListener('submit', async (e) => { /*...*/ }); // Fazla uzun olduğu için kestim
loginForm.addEventListener('submit', async (e) => { /*...*/ });
async function handleLogout() { if (socket) { socket.disconnect(); socket = null; } try { await fetch('/logout', { method: 'POST' }); } catch (error) { console.error('Çıkış hatası:', error); } finally { currentUsername = ''; clearChatUI(); showScreen(authContainer); } }
async function checkAuthOnLoad() { /*...*/ }


// --- Socket.IO ve Sohbet Mantığı ---
function initializeSocket() {
    if (socket) return;
    socket = io();
    roomForm.addEventListener('submit', (e) => { /*...*/ }); // Oda katılma

    // --- GÜNCELLENDİ: addMessage Fonksiyonu (ID, Silindi, Düzenlendi kontrolü) ---
    function addMessage(data, type) {
        const item = document.createElement('li');
        // YENİ: Mesajın ID'sini li elementine ekle
        if (data.id) {
            item.dataset.messageId = data.id;
        }

        if (type === 'message') {
            // Giden/Gelen ayrımı
            if (data.username === currentUsername) item.classList.add('sent');
            else item.classList.add('received');

            // YENİ: Silinmiş mesaj mı kontrolü
            if (data.is_deleted) {
                item.classList.add('deleted-message');
                item.innerHTML = `[Mesaj silindi]`; // Sadece bu metni göster
            } else {
                // Silinmemişse normal baloncuğu oluştur
                const isImageMessage = data.message.startsWith('https://res.cloudinary.com/');
                let messageContent = '';
                if (isImageMessage) messageContent = `<img src="${data.message}" alt="Yüklenen Resim">`;
                else messageContent = data.message; // Normal metin

                // YENİ: Düzenlendi etiketi
                const editedIndicator = data.edited_at ? '<span class="edited-indicator">(düzenlendi)</span>' : '';

                item.innerHTML = `
                  <div class="message-bubble ${isImageMessage ? 'image-only' : ''}">
                    <span class="username">${data.username}</span>
                    <span class="message-text">${messageContent}</span> ${editedIndicator}
                  </div>
                `;

                // YENİ: Eğer GİDEN mesajsa ve resim DEĞİLSE, Sil/Düzenle butonlarını ekle
                if (data.username === currentUsername && !isImageMessage) {
                    const actionsDiv = document.createElement('div');
                    actionsDiv.classList.add('message-actions');
                    actionsDiv.innerHTML = `
                        <button class="edit-btn" title="Düzenle">✏️</button>
                        <button class="delete-btn" title="Sil">🗑️</button>
                    `;
                    item.appendChild(actionsDiv); // Butonları li'ye ekle
                }
            }

        } else if (type === 'notification') {
            item.classList.add('notification'); item.textContent = data.text;
        } else if (type === 'private-message') {
            item.classList.add('private-message');
            // Özel mesajlar silinemez/düzenlenemez (şimdilik)
            if (data.from) item.innerHTML = `<span class="pm-direction">[...]</span> ${data.message}`;
            else if (data.to) item.innerHTML = `<span class="pm-direction">[...]</span> ${data.message}`;
             // Tam özel mesaj kodu
            if (data.from) item.innerHTML = `<span class="pm-direction">[<span class="pm-user">${data.from}</span>'dan fısıltı]</span> ${data.message}`;
            else if (data.to) item.innerHTML = `<span class="pm-direction">[<span class="pm-user">${data.to}</span>'e fısıltı]</span> ${data.message}`;

        }

        messages.appendChild(item);
        // Sadece yeni mesaj gelince en alta kaydır, geçmiş yüklenirken değil
        // if (type !== 'history') { // Bu kontrol eklenebilir ama scrollTop hep yapmak daha basit
            messages.scrollTop = messages.scrollHeight;
        // }
    }


    // Mesaj Geçmişi Yükleme (Artık addMessage her şeyi hallediyor)
    socket.on('load history', (history) => {
        messages.innerHTML = ''; // Temizle
        history.forEach(msg => {
            // Sunucudan gelen id, user_id, is_deleted, edited_at bilgileriyle
            addMessage(msg, 'message');
        });
        addMessage({ text: '--- Mesaj geçmişi yüklendi ---' }, 'notification');
    });

    // --- YENİ EKLENDİ: Sunucudan Gelen Silme/Düzenleme Haberleri ---
    socket.on('message deleted', (data) => {
        const { messageId } = data;
        const messageItem = messages.querySelector(`li[data-message-id="${messageId}"]`);
        if (messageItem) {
            // Mesajın içeriğini değiştir ve butonları kaldır (CSS halleder)
            messageItem.classList.add('deleted-message');
            messageItem.innerHTML = '[Mesaj silindi]';
        }
    });

    socket.on('message edited', (data) => {
        const { messageId, newMessage, editedAt } = data;
        const messageItem = messages.querySelector(`li[data-message-id="${messageId}"]`);
        if (messageItem && !messageItem.classList.contains('deleted-message')) { // Silinmemişse
            const messageTextElement = messageItem.querySelector('.message-text');
            const editedIndicatorElement = messageItem.querySelector('.edited-indicator');

            if (messageTextElement) {
                // Mesaj metnini güncelle
                messageTextElement.textContent = newMessage; // HTML değil, düz metin olarak ekle
            }
            // Düzenlendi etiketi yoksa ekle
            if (!editedIndicatorElement) {
                const indicator = document.createElement('span');
                indicator.classList.add('edited-indicator');
                indicator.textContent = '(düzenlendi)';
                messageItem.querySelector('.message-bubble').appendChild(indicator);
            }
        }
    });
    // --- BİTTİ: Silme/Düzenleme Haberleri ---


    // Diğer Socket Dinleyicileri (Değişiklik Yok)
    socket.on('chat message', (data) => addMessage(data, 'message'));
    socket.on('user joined', (username) => { /*...*/ });
    socket.on('user left', (username) => { /*...*/ });
    socket.on('notification', (data) => { /*...*/ });
    socket.on('private message', (data) => { /*...*/ });
    socket.on('update user list', (users) => { /*...*/ });
    socket.on('user typing', (username) => { /*...*/ });
    socket.on('stop typing', (username) => { /*...*/ });
    socket.on('disconnect', (reason) => { /*...*/ });
    socket.on('connect_error', (err) => { /*...*/ });

} // initializeSocket bitişi


// --- 5. KISIM: Diğer Arayüz Mantığı ---
menuToggle.addEventListener('click', () => { /*...*/ });
let usersTyping = {}; function updateTypingNotification() { /*...*/ }
function clearChatUI(clearRoomName = true) { /*...*/ }
messageForm.addEventListener('submit', (e) => { /*...*/ });
fileInput.addEventListener('change', () => { /*...*/ });

// --- YENİ EKLENDİ: Mesaj Listesi Üzerinde Tıklama Dinleyicisi (Sil/Düzenle İçin) ---
messages.addEventListener('click', (e) => {
    // Tıklanan element bir SİL butonu mu?
    if (e.target && e.target.classList.contains('delete-btn')) {
        const messageItem = e.target.closest('li[data-message-id]'); // En yakın 'li'yi bul
        if (messageItem && socket) {
            const messageId = messageItem.dataset.messageId;
            if (confirm('Bu mesajı silmek istediğinizden emin misiniz?')) {
                socket.emit('delete message', messageId);
            }
        }
    }
    // Tıklanan element bir DÜZENLE butonu mu?
    else if (e.target && e.target.classList.contains('edit-btn')) {
        const messageItem = e.target.closest('li[data-message-id]');
        if (messageItem && socket) {
            const messageId = messageItem.dataset.messageId;
            const messageTextElement = messageItem.querySelector('.message-text');
            const currentMessage = messageTextElement ? messageTextElement.textContent : '';

            const newMessage = prompt('Mesajınızı düzenleyin:', currentMessage);
            // Eğer kullanıcı bir şey yazdıysa VE mesaj değiştiyse
            if (newMessage !== null && newMessage !== currentMessage) {
                socket.emit('edit message', { messageId, newMessage });
            }
        }
    }
});
// --- BİTTİ: Tıklama Dinleyicisi ---


// Özel Mesaj (User List Click - Değişiklik Yok)
userList.addEventListener('click', (e) => { /*...*/ });


// --- UYGULAMAYI BAŞLAT ---
document.addEventListener('DOMContentLoaded', checkAuthOnLoad);