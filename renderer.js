const ctx = document.getElementById('powerChart').getContext('2d');

const data = {
    labels: [], // Time in seconds
    datasets: [
        {
            label: 'Power Consumption (W)',
            data: [],
            borderColor: 'blue',
            borderWidth: 2,
            fill: false
        },
        {
            label: 'Carbon Emissions (gCO2)',
            data: [],
            borderColor: 'red',
            borderWidth: 2,
            fill: false
        }
    ]
};

const chart = new Chart(ctx, {
    type: 'line',
    data: data,
    options: {
        responsive: true,
        scales: {
            x: {
                title: {
                    display: true,
                    text: 'Time (s)'
                }
            },
            y: {
                title: {
                    display: true,
                    text: 'Values'
                }
            }
        }
    }
});

let elapsedTime = 0;

// Function to fetch system usage and update the graph
async function updateGraph() {
    const { cpuLoad, gpuLoad, totalPower } = await window.api.getSystemUsage();

    const carbonIntensity = 820; // India's grid average: 820 gCO2/kWh
    const emissions = (totalPower / 1000) * (carbonIntensity / 3600); // gCO2 per second

    // Update chart data
    data.labels.push(elapsedTime++);
    data.datasets[0].data.push(totalPower);
    data.datasets[1].data.push(emissions);

    // Keep chart within the last 30 seconds
    if (data.labels.length > 30) {
        data.labels.shift();
        data.datasets[0].data.shift();
        data.datasets[1].data.shift();
    }

    chart.update();
}

// Call updateGraph every second
setInterval(updateGraph, 1000);
