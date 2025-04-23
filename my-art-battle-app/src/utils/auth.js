// src/utils/auth.js
export function openOAuthPopup(provider, onSuccess) {
  const width = 500, height = 600;
  const left = window.screenX + (window.outerWidth - width) / 2;
  const top = window.screenY + (window.outerHeight - height) / 2;
  const url = `${process.env.REACT_APP_API_URL}/auth/${provider}`;
  const win = window.open(
    url,
    `${provider}-login`,
    `width=${width},height=${height},left=${left},top=${top}`
  );
  window.addEventListener('message', function handler(e) {
    const allowedOrigins = [process.env.REACT_APP_API_URL, 'http://localhost:3000'];
    if (allowedOrigins.includes(e.origin) && e.data === 'oauth-success') {
      onSuccess();
      // --- Force socket.io reconnect to refresh session ---
      try {
        const socket = require('../socket').default;
        if (socket && socket.connected) {
          socket.disconnect();
        }
        setTimeout(() => {
          socket.connect();
        }, 200);
      } catch (err) {
        // ignore if socket import fails
      }
      if (window.opener) {
        const origin = window.opener.location.origin || window.location.origin;
        window.opener.postMessage('oauth-success', origin);
        window.opener.location.reload();
      }
      window.close();
    }
  });
}
