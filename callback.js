const API_BASE = "https://miri-production.up.railway.app";
const statusEl = document.getElementById("status");

(async function handleOAuthCallback(){
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const error = params.get("error");

  if(error){
    statusEl.textContent = `Discord login failed: ${error}`;
    return;
  }

  if(!code){
    statusEl.textContent = "Missing authorization code.";
    return;
  }

  try{
    const redirectUri = `${window.location.origin}${window.location.pathname}`;

    const res = await fetch(`${API_BASE}/auth/discord/exchange`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "include",
      body: JSON.stringify({
        code,
        redirectUri
      })
    });

    const data = await res.json().catch(() => ({}));

    if(!res.ok){
      throw new Error(data.error || `Auth exchange failed (${res.status})`);
    }

    if(data.token){
      localStorage.setItem("miri_token", data.token);
    }

    const targetPath = localStorage.getItem("miri_post_auth_path") || "/";
    localStorage.removeItem("miri_post_auth_path");

    statusEl.textContent = "Login complete. Redirecting...";

    const safePath = targetPath.startsWith("/") ? targetPath : "/";
    window.location.replace(safePath);
  }catch(err){
    statusEl.textContent = err.message || "Login failed.";
  }
})();
