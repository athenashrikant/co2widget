const { contextBridge } = require('electron');
const si = require('systeminformation');

contextBridge.exposeInMainWorld('api', {
    getSystemUsage: async () => {
        try {
            const cpuLoad = await si.currentLoad();
            const gpuData = await si.graphics();

            const gpuLoad = gpuData.controllers.reduce((acc, gpu) => acc + gpu.utilizationGpu, 0) / gpuData.controllers.length || 0;

            const basePower = 15; // Idle base power in watts
            const cpuPower = (cpuLoad.currentLoad / 100) * 35; // CPU max power assumption: 35W
            const gpuPower = (gpuLoad / 100) * 50; // GPU max power assumption: 50W

            const totalPower = basePower + cpuPower + gpuPower;

            return { cpuLoad: cpuLoad.currentLoad, gpuLoad, totalPower };
        } catch (error) {
            console.error('Error fetching system usage:', error);
            return { cpuLoad: 0, gpuLoad: 0, totalPower: 0 };
        }
    }
});
