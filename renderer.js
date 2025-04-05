// At the top
if (typeof ipcRenderer === 'undefined') {
  var { ipcRenderer } = require('electron');
}

const { machineIdSync } = require('node-machine-id');

console.log("✅ renderer.js loaded");

const CO2_PER_KWH = 0.82;
let total_energy_kwh = parseFloat(localStorage.getItem('energy_kwh')) || 0;
let total_co2 = parseFloat(localStorage.getItem('co2_emissions')) || 0;

// Firebase App via CDN
const firebaseConfig = {
  apiKey: "AIzaSyDVNHHHN4UtYA8uQaL1n4oCWcI9_6E1gJ8",
  authDomain: "wattaware-718b3.firebaseapp.com",
  projectId: "wattaware-718b3",
  storageBucket: "wattaware-718b3.appspot.com",
  messagingSenderId: "46958510191",
  appId: "1:46958510191:web:9b259ae97ee67083d5cd9a",
  measurementId: "G-XNLFX18H7L"
};

const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Use unique device ID
const deviceId = machineIdSync();

let lastPayload = {};

const powerCtx = document.getElementById('powerChart').getContext('2d');
const co2Ctx = document.getElementById('carbonChart').getContext('2d');

const powerChart = new Chart(powerCtx, {
  type: 'doughnut',
  data: {
    labels: ['Current Power (W)', 'Remaining (100 W max)'],
    datasets: [{
      data: [0, 100],
      backgroundColor: ['#36a2eb', '#e0e0e0'],
      borderWidth: 2,
    }]
  },
  options: {
    cutout: '70%',
    plugins: { legend: { position: 'bottom' } },
    animation: false
  }
});

const co2Chart = new Chart(co2Ctx, {
  type: 'doughnut',
  data: {
    labels: ['CO2 Emitted (kg)', 'Remaining to 100kg'],
    datasets: [{
      data: [0, 100],
      backgroundColor: ['#ff6384', '#e0e0e0'],
      borderWidth: 2,
    }]
  },
  options: {
    cutout: '70%',
    plugins: { legend: { position: 'bottom' } },
    animation: false
  }
});

ipcRenderer.on('power-data', (event, data) => {
  console.log("📡 Received power-data:", data);

  const power = data.power_watts || 0;
  const energy_wh = power / 3600;
  const energy_kwh = energy_wh / 1000;

  total_energy_kwh += energy_kwh;
  total_co2 = total_energy_kwh * CO2_PER_KWH;

  localStorage.setItem('energy_kwh', total_energy_kwh.toFixed(6));
  localStorage.setItem('co2_emissions', total_co2.toFixed(6));

  document.getElementById('uptime').textContent = 'Live';
  document.getElementById('energy').textContent = total_energy_kwh.toFixed(4);
  document.getElementById('co2').textContent = total_co2.toFixed(4);
  document.getElementById('status').textContent = `Live Power: ${power.toFixed(1)} W`;
  document.getElementById('status').style.color = '#36a2eb';

  powerChart.data.datasets[0].data = [power, Math.max(0, 100 - power)];
  powerChart.update();

  co2Chart.data.datasets[0].data = [total_co2, Math.max(0, 100 - total_co2)];
  co2Chart.update();

  lastPayload = {
    timestamp: new Date().toISOString(),
    power_watts: power,
    energy_kwh: total_energy_kwh,
    co2_emissions: total_co2,
    method: data.method || 'Unknown'
  };
});

setInterval(async () => {
  if (lastPayload && lastPayload.timestamp) {
    try {
      const docRef = db.collection('laptop_power_logs').doc(deviceId);
      await docRef.set(lastPayload, { merge: true });
      console.log("✅ Updated Firebase for", deviceId, lastPayload);
    } catch (e) {
      console.error("❌ Firebase error:", e);
    }
  }
}, 30000);
