const chatMessages = document.getElementById("chatMessages");
const messageInput = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");

let currentUser = null;

bootChat();

async function bootChat(){
  const shell = await hydrateShell();
  const allowed = await requirePageAccess("chat");

  if(!allowed) return;

  currentUser = shell.user;
  sendButton.addEventListener("click", sendMessage);
  messageInput.addEventListener("keypress", event => {
    if(event.key === "Enter") sendMessage();
  });
}

async function sendMessage(){
  const message = messageInput.value.trim();

  if(!message) return;

  addMessage("user", message);

  messageInput.value = "";
  sendButton.disabled = true;

  try{
    const data = await apiFetch("/chat", {
      method: "POST",
      body: JSON.stringify({
        message,
        userContext: currentUser
          ? {
            id: currentUser.id,
            username: currentUser.username,
            globalName: currentUser.global_name || currentUser.globalName || null
          }
          : null
      })
    });

    addMessage("bot", data.response || "No response.");
  }catch(err){
    addMessage("bot", err.message || "Connection error.");
  }

  sendButton.disabled = false;
}

function addMessage(type, text){
  const div = document.createElement("div");
  div.className = `message ${type}-message`;

  if(type === "user"){
    const badge = document.createElement("div");
    badge.className = "message-identity-badge";
    badge.textContent = `Logged in as ${getActiveIdentityLabel()}`;

    const body = document.createElement("div");
    body.className = "message-text";
    body.textContent = text;

    div.appendChild(badge);
    div.appendChild(body);
  }else{
    div.textContent = text;
  }

  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function getActiveIdentityLabel(){
  if(currentUser?.global_name) return currentUser.global_name;
  if(currentUser?.globalName) return currentUser.globalName;
  if(currentUser?.username) return currentUser.username;
  return "Guest";
}
