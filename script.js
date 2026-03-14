// script.js
const API_BASE = 'https://dfb29837.miri-web-hosting.pages.dev'; // Assuming the webpage is served from the same server

const statusDiv = document.getElementById('status');
const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');

let isOnline = false;

// Check status every 30 seconds
async function checkStatus() {
    try {
        const response = await fetch(`${API_BASE}/status`);
        const data = await response.json();
        isOnline = data.online;
        statusDiv.className = `status ${isOnline ? 'online' : 'offline'}`;
        statusDiv.textContent = isOnline ? '🟢 Miri is Online' : '🔴 Miri is Offline';
    } catch (error) {
        console.error('Status check failed:', error);
        statusDiv.className = 'status offline';
        statusDiv.textContent = '❓ Unable to check status';
        isOnline = false;
    }
}

// Send message
async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message) return;

    // Add user message to chat
    addMessage('user', message);
    messageInput.value = '';
    sendButton.disabled = true;

    try {
        const response = await fetch(`${API_BASE}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message }),
        });

        const data = await response.json();
        
        if (response.ok) {
            addMessage('bot', data.response);
        } else {
            addMessage('bot', `Error: ${data.error}`);
        }
    } catch (error) {
        console.error('Chat request failed:', error);
        addMessage('bot', 'Sorry, I couldn\'t send your message. Please try again.');
    } finally {
        sendButton.disabled = false;
    }
}

// Add message to chat
function addMessage(type, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}-message`;
    messageDiv.textContent = content;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Event listeners
sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// Initial status check and start polling
checkStatus();
setInterval(checkStatus, 30000);
