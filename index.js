const { ipcRenderer } = require('electron');

// Redirect to login if user is not authenticated
if (!localStorage.getItem("auth")) {
  ipcRenderer.send('logout');
}

// Logout handler
window.logout = function () {
  localStorage.removeItem("auth");
  ipcRenderer.send('logout');
};
