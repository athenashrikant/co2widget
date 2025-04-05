const { ipcRenderer } = require('electron');

if (!localStorage.getItem("auth")) {
  ipcRenderer.send('logout');
}

window.logout = function () {
  localStorage.removeItem("auth");
  ipcRenderer.send('logout');
};
