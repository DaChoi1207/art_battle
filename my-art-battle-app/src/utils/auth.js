// src/utils/auth.js
export function openOAuthPopup(provider, onSuccess) {
  const width = 500, height = 600;
  const left = window.screenX + (window.outerWidth - width) / 2;
  const top = window.screenY + (window.outerHeight - height) / 2;
  const url = `https://dcbg.win/auth/${provider}`;
  const win = window.open(
    url,
    `${provider}-login`,
    `width=${width},height=${height},left=${left},top=${top}`
  );
  window.addEventListener('message', function handler(e) {
    if (e.origin === 'http://localhost:3000' && e.data === 'oauth-success') {
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
        window.opener.postMessage('oauth-success', 'http://localhost:3000');
        window.opener.location.reload();
      }
      window.close();
    }
  });
}
