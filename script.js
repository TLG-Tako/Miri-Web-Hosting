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
const loginBtn = document.getElementById("loginBtn");
const authHint = document.getElementById("authHint");
let currentUser = null;

const urlToken = new URLSearchParams(window.location.search).get("token");

if(urlToken){
  localStorage.setItem("miri_token", urlToken);
  window.history.replaceState({}, document.title, window.location.pathname);
}

const savedToken = localStorage.getItem("miri_token");

if(savedToken){
  currentUser = parseJwt(savedToken);

  if(currentUser){
    userPanel.style.display = "flex";
    userName.textContent = `👤 Logged in as ${currentUser.username}`;
    if(currentUser.avatar){
      userAvatar.src =
        `https://cdn.discordapp.com/avatars/${currentUser.id}/${currentUser.avatar}.png`;
    }else{
      userAvatar.src = `https://cdn.discordapp.com/embed/avatars/${Number(currentUser.discriminator || 0) % 5}.png`;
    }
    authHint.textContent = `Miri can identify you as ${currentUser.username}.`;
    loginBtn.style.display = "none";
  }
}

loginBtn.onclick=()=>{
  const returnTo = encodeURIComponent(window.location.pathname);
  window.location.href = `${API_BASE}/login?returnTo=${returnTo}`;
};

logoutBtn.onclick = () => {

  localStorage.removeItem("miri_token");

  currentUser = null;

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
`${toTitleCase(data.mood || data.state?.mood || "unknown")}`;

const emotions = normalizeEmotions(data.emotions || data.state?.emotions || data.emotion || data.feelings);
document.getElementById("emotions").textContent = emotions || "None";

document.getElementById("energy").textContent = `${formatEnergy(data.energy || data.state?.energy)}`;

document.getElementById("diary").textContent =
`${data.diary?.summary || data.diarySummary || "None"}`;

document.getElementById("vision").textContent =
`${data.vision?.[0] || data.focus || "None"}`;

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
.sort((a,b) => b[1] - a[1])
.slice(0,6)
.map(([k,v]) => `${k} (${Number(v).toFixed(2)})`)
.join(", ");

document.getElementById("thoughts").textContent =
`${formatted || "None"}`;

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
const headers = {
  "Content-Type":"application/json"
};

if(token){
  headers.Authorization = token;
}

const res = await fetch(`${API_BASE}/chat`,{
method:"POST",

headers,
body:JSON.stringify({
  message,
  userContext: currentUser
    ? {
        id: currentUser.id,
        username: currentUser.username,
        globalName: currentUser.global_name || null
      }
    : null
})
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
div.textContent=text;
}

chatMessages.appendChild(div);

chatMessages.scrollTop=chatMessages.scrollHeight;

}

function getActiveIdentityLabel(){
if(currentUser?.global_name) return currentUser.global_name;
if(currentUser?.username) return currentUser.username;
return "Guest";
}

function normalizeEmotions(rawEmotions){
if(!rawEmotions) return "None";

if(Array.isArray(rawEmotions)) return rawEmotions.join(", ");

if(typeof rawEmotions === "string") return rawEmotions;

if(typeof rawEmotions === "object"){
return Object.entries(rawEmotions)
.sort((a,b) => Number(b[1]) - Number(a[1]))
.slice(0,4)
.map(([emotion,weight]) => `${emotion} (${Number(weight).toFixed(2)})`)
.join(", ");
}

return String(rawEmotions);
}

function formatEnergy(rawEnergy){
if(rawEnergy === null || rawEnergy === undefined || rawEnergy === "") return "Unknown";

if(typeof rawEnergy === "number") return `${Math.round(rawEnergy)}%`;

return String(rawEnergy);
}

function toTitleCase(value){
return String(value)
.split(" ")
.map(part => part ? part[0].toUpperCase() + part.slice(1) : part)
.join(" ");
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