// script.js

const API_BASE = "https://miri-production.up.railway.app";

const statusDiv = document.getElementById("status");
const chatMessages = document.getElementById("chatMessages");
const messageInput = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");
const userPanel = document.getElementById("userPanel");
const userName = document.getElementById("userName");
const userAvatar = document.getElementById("userAvatar");
const logoutBtn = document.getElementById("logoutBtn");
const token = new URLSearchParams(window.location.search).get("token");

const urlToken = new URLSearchParams(window.location.search).get("token");

if(urlToken){
  localStorage.setItem("miri_token", urlToken);
  window.history.replaceState({}, document.title, "/");
}

const savedToken = localStorage.getItem("miri_token");

if(savedToken){

  const user = parseJwt(savedToken);

  if(user){

    userPanel.style.display = "block";

    userName.textContent = `👤 Logged in as ${user.username}`;

    userAvatar.src =
      `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;

  }

}

document.getElementById("loginBtn").onclick=()=>{
  window.location.href = `${API_BASE}/login`;
};

logoutBtn.onclick = () => {

  localStorage.removeItem("miri_token");

  location.reload();

};

function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

/*
STATUS
*/
async function checkStatus(){

try{

const res = await fetch(`${API_BASE}/status`);
const data = await res.json();

statusDiv.className = `status ${data.online ? "online" : "offline"}`;
statusDiv.textContent =
data.online ? "🟢 Miri is Online" : "🔴 Miri is Offline";

}catch(err){

statusDiv.className="status offline";
statusDiv.textContent="❓ Unable to check status";

}

}

/*
STATS
*/
async function updateStats(){

try{

const res = await fetch(`${API_BASE}/stats`);
const data = await res.json();

document.getElementById("mood").textContent =
`🧠 Mood: ${data.mood || "unknown"} | Energy: ${data.energy || "?"}`;

document.getElementById("diary").textContent =
`📖 Diary: ${data.diary?.summary || "None"}`;

document.getElementById("vision").textContent =
`👁 Vision: ${data.vision?.[0] || "None"}`;

}catch(err){

console.error("Stats failed:",err);

}

}

/*
THOUGHTS
*/
async function updateThoughts(){

try{

const res = await fetch(`${API_BASE}/thoughts`);
const data = await res.json();

const entries = Object.entries(data.thoughts || {});

const formatted = entries
.map(([k,v]) => `${k} (${v.toFixed(2)})`)
.join(", ");

document.getElementById("thoughts").textContent =
`💭 Thoughts: ${formatted || "None"}`;

}catch(err){

console.error("Thoughts failed:",err);

}

}

/*
CHAT
*/
async function sendMessage(){

const message = messageInput.value.trim();

if(!message) return;

addMessage("user",message);

messageInput.value="";
sendButton.disabled=true;

try{

const token = localStorage.getItem("miri_token");
const res = await fetch(`${API_BASE}/chat`,{
method:"POST",

headers:{
  "Content-Type":"application/json",
  "Authorization":token
},
body:JSON.stringify({message})
});

const data = await res.json();

addMessage("bot",data.response);

}catch(err){

addMessage("bot","Connection error.");

}

sendButton.disabled=false;

}

function addMessage(type,text){

const div=document.createElement("div");

div.className=`message ${type}-message`;

div.textContent=text;

chatMessages.appendChild(div);

chatMessages.scrollTop=chatMessages.scrollHeight;

}

sendButton.onclick=sendMessage;

messageInput.addEventListener("keypress",e=>{
if(e.key==="Enter") sendMessage();
});

/*
START POLLING
*/

checkStatus();
updateStats();
updateThoughts();

setInterval(checkStatus,30000);
setInterval(updateStats,5000);
setInterval(updateThoughts,5000);