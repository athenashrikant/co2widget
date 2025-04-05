// At the top
if (typeof ipcRenderer === 'undefined') {
    var { ipcRenderer } = require('electron');
  }
  

window.logout = function () {
  localStorage.removeItem("auth");
  ipcRenderer.send('logout');
};
