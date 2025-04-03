const { ipcRenderer } = require('electron');

const CO2_PER_KWH = 0.82;
let total_energy_kwh = 0;
let total_co2 = 0;

// Setup chart contexts
const powerCtx = document.getElementById('powerChart').getContext('2d');
const co2Ctx = document.getElementById('carbonChart').getContext('2d');

// Chart #1 – Power Output (Live)
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

// Chart #2 – CO₂ Emissions (Cumulative)
const co2Chart = new Chart(co2Ctx, {
  type: 'doughnut',
  data: {
    labels: ['CO2 Emitted (kg)', 'Remaining (max 3 kg)'],
    datasets: [{
      data: [0, 3],
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

// Real-time listener
ipcRenderer.on('power-data', (event, data) => {
  const power = data.power_watts || 0;
  const energy_wh = power / 3600;
  const energy_kwh = energy_wh / 1000;

  // Update totals
  total_energy_kwh += energy_kwh;
  total_co2 = total_energy_kwh * CO2_PER_KWH;

  // Update HTML
  document.getElementById('uptime').textContent = 'Live';
  document.getElementById('energy').textContent = total_energy_kwh.toFixed(4);
  document.getElementById('co2').textContent = total_co2.toFixed(4);
  document.getElementById('status').textContent = `Live Power: ${power.toFixed(1)} W`;
  document.getElementById('status').style.color = '#36a2eb';

  // Update Charts
  powerChart.data.datasets[0].data = [power, Math.max(0, 100 - power)];
  powerChart.update();

  const capped_co2 = Math.min(total_co2, 3);
  co2Chart.data.datasets[0].data = [capped_co2, 3 - capped_co2];
  co2Chart.update();
});
