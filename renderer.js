const { ipcRenderer } = require('electron');

// Function to fetch data from the Python script
async function fetchData() {
  return new Promise((resolve, reject) => {
    ipcRenderer.once('data-response', (_, data) => {
      if (data.error) {
        reject(data.error);
      } else {
        resolve(data);
      }
    });

    ipcRenderer.send('fetch-data'); // Trigger data fetch in the main process
  });
}

// Function to update the Chart.js chart with a 10 kg maximum capacity
function updateChart(value) {
  const maxCapacity = 3; // Set the wheel's capacity to 10 kilograms
  const ctx = document.getElementById('carbonChart').getContext('2d');

  // Create a gradient color for dramatic effect
  const gradient = ctx.createLinearGradient(0, 0, 0, 400);
  gradient.addColorStop(0, value > 1 ? '#ff4d4d' : value > 2 ? '#ffcc00' : '#36a2eb');
  gradient.addColorStop(1, '#ffffff');

  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['CO2 Emissions (kg)', 'Remaining Capacity (kg)'],
      datasets: [{
        data: [value, maxCapacity - value], // Use the 10 kg max capacity
        backgroundColor: [gradient, '#e0e0e0'], // Gradient for CO2, gray for remaining
        hoverBackgroundColor: [gradient, '#e0e0e0'],
        borderWidth: 2,
      }],
    },
    options: {
      cutout: '75%', // Bigger hole in the center for aesthetics
      plugins: {
        tooltip: {
          callbacks: {
            label: function (tooltipItem) {
              return `${tooltipItem.label}: ${tooltipItem.raw.toFixed(2)} kg`;
            },
          },
        },
      },
      animation: {
        animateRotate: true,
        animateScale: true,
      },
    },
  });

  // Update the status text dynamically based on the CO2 value
  const statusElement = document.getElementById('status');
  if (value > 7.5) {
    statusElement.textContent = 'High Emissions! 🌡️';
    statusElement.style.color = '#ff4d4d';
  } else if (value > 5) {
    statusElement.textContent = 'Moderate Emissions ⚠️';
    statusElement.style.color = '#ffcc00';
  } else {
    statusElement.textContent = 'Low Emissions! ✅';
    statusElement.style.color = '#36a2eb';
  }
}

// Fetch data and update the dashboard
async function updateDashboard() {
  try {
    const data = await fetchData();

    // Cap the displayed CO2 emissions to the maximum capacity (10 kg)
    const co2Emissions = Math.min(data.co2_emissions, 10);

    // Update UI text
    document.getElementById('uptime').textContent = data.uptime.toFixed(2);
    document.getElementById('energy').textContent = data.energy_kwh.toFixed(2);
    document.getElementById('co2').textContent = co2Emissions.toFixed(2);

    // Update the chart
    updateChart(co2Emissions);
  } catch (error) {
    console.error('Error fetching data:', error);
    document.getElementById('status').textContent = 'Error fetching data.';
    document.getElementById('status').style.color = '#ff4d4d';
  }
}

// Initialize the dashboard
updateDashboard();
