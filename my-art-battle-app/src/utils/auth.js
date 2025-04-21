// src/utils/auth.js
export function openOAuthPopup(provider, onSuccess) {
  const width = 500, height = 600;
  const left = window.screenX + (window.outerWidth - width) / 2;
  const top = window.screenY + (window.outerHeight - height) / 2;
  const url = `http://localhost:3001/auth/${provider}`;
  const win = window.open(
    url,
    `${provider}-login`,
    `width=${width},height=${height},left=${left},top=${top}`
  );
  window.addEventListener('message', function handler(e) {
    if (e.origin === 'http://localhost:3000' && e.data === 'oauth-success') {
      onSuccess();
      window.removeEventListener('message', handler);
      win && win.close();
    }
  });
}
