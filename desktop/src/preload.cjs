const { ipcRenderer } = require('electron');

if (process.isMainFrame) {
  window.addEventListener('DOMContentLoaded', () => {
    const controls = document.createElement('div');
    controls.id = 'scenearix-desktop-controls';
    controls.setAttribute('role', 'group');
    controls.setAttribute('aria-label', 'Desktop window controls');
    const icons = {
      minimize: '<path d="M3 8h10"/>',
      maximize: '<rect x="3" y="3" width="10" height="10" rx="1"/>',
      restore: '<path d="M6 3h7v7M3 6h7v7H3z"/>',
      close: '<path d="m4 4 8 8m0-8-8 8"/>'
    };
    const buttons = {};
    const setIcon = (button, icon) => { button.innerHTML = `<svg viewBox="0 0 16 16" aria-hidden="true">${icons[icon]}</svg>`; };
    for (const [action, label] of [['minimize', 'Minimize'], ['maximize', 'Maximize'], ['close', 'Close to tray']]) {
      const button = document.createElement('button');
      button.type = 'button'; button.title = label; button.setAttribute('aria-label', label);
      setIcon(button, action);
      button.addEventListener('click', () => ipcRenderer.send('scenearix:window-control', action));
      controls.append(button); buttons[action] = button;
    }
    const drag = document.createElement('div');
    drag.id = 'scenearix-desktop-drag';
    document.body.append(drag);
    const mountControls = () => {
      const navbar = document.querySelector('[data-scenearix-desktop-navbar]');
      const target = navbar || document.body;
      if (controls.parentElement !== target) target.append(controls);
      controls.dataset.location = navbar ? 'navbar' : 'fallback';
    };
    mountControls();
    new MutationObserver(mountControls).observe(document.body, { childList: true, subtree: true });
    ipcRenderer.on('scenearix:window-state', (_event, state) => {
      const restored = state.maximized || state.fullscreen;
      setIcon(buttons.maximize, restored ? 'restore' : 'maximize');
      buttons.maximize.title = restored ? 'Restore' : 'Maximize';
    });
    ipcRenderer.send('scenearix:window-control', 'state');
  });
}
