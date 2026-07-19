// === power_tracker.js ===
// Pure Node.js port of adaptive_power_tracker.py + data.py
// Runs inside the Electron main process — no Python needed.
//
// Requires one npm package:  npm install systeminformation

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const si = require('systeminformation');

const round2 = (n) => Math.round(n * 100) / 100;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function readIntFile(filePath) {
	try {
		return parseInt(fs.readFileSync(filePath, 'utf8').trim(), 10);
	} catch {
		return null;
	}
}

/* ---------------------------------------------------------------
 * 1. Linux — Intel RAPL via the powercap sysfs interface.
 *    (Replaces pyRAPL: we read the energy counter twice, 1s apart.
 *    energy_uj is microjoules, so ΔµJ over 1 second = µW → W.)
 * --------------------------------------------------------------- */
const RAPL_PATHS = [
	'/sys/class/powercap/intel-rapl:0/energy_uj',
	'/sys/class/powercap/intel-rapl/intel-rapl:0/energy_uj'
];

async function getPowerLinuxRAPL() {
	const raplPath = RAPL_PATHS.find((p) => fs.existsSync(p));
	if (!raplPath) return null;

	const e1 = readIntFile(raplPath);
	if (e1 === null) return null;

	await sleep(1000);

	const e2 = readIntFile(raplPath);
	if (e2 === null || e2 <= e1) return null; // unreadable or counter wrapped

	const watts = (e2 - e1) / 1_000_000;
	return { power: round2(watts), method: 'Intel RAPL (powercap)' };
}

/* ---------------------------------------------------------------
 * 2. Linux — battery voltage × current
 * --------------------------------------------------------------- */
function getPowerLinuxBattery() {
	// Some batteries expose power_now directly (µW)
	const powerNow = readIntFile('/sys/class/power_supply/BAT0/power_now');
	if (powerNow) {
		return { power: round2(powerNow / 1_000_000), method: 'Battery power_now' };
	}

	const currentNow = readIntFile('/sys/class/power_supply/BAT0/current_now');
	const voltageNow = readIntFile('/sys/class/power_supply/BAT0/voltage_now');

	if (currentNow && voltageNow) {
		const power = (currentNow / 1_000_000) * (voltageNow / 1_000_000);
		return { power: round2(power), method: 'Battery voltage × current' };
	}

	return null;
}

/* ---------------------------------------------------------------
 * 3. Windows — Intel Power Gadget (PowerLog3.0.exe), same as Python
 * --------------------------------------------------------------- */
const POWERLOG_PATHS = [
	'PowerLog3.0.exe',
	'C:\\Program Files\\Intel\\Power Gadget 3.0\\PowerLog3.0.exe',
	'C:\\Program Files (x86)\\Intel\\Power Gadget 3.0\\PowerLog3.0.exe'
];

function getPowerWindowsIntel() {
	return new Promise((resolve) => {
		const exePath = POWERLOG_PATHS.find(
			(p) => p === 'PowerLog3.0.exe' || fs.existsSync(p)
		);
		if (!exePath) return resolve(null);

		execFile(
			exePath,
			['-resolution', '1', '-duration', '1'],
			{ windowsHide: true, timeout: 10_000 },
			(err, stdout) => {
				if (err || !stdout) return resolve(null);

				const line = stdout
					.split(/\r?\n/)
					.find((l) => l.includes('Total Package Power'));

				if (!line) return resolve(null);

				const power = parseFloat(line.split(',').pop());
				if (Number.isNaN(power)) return resolve(null);

				resolve({ power: round2(power), method: 'Intel Power Gadget' });
			}
		);
	});
}

/* ---------------------------------------------------------------
 * 4. Generic fallback — estimate from CPU + Disk + Network + GPU
 *    (Same coefficients as the Python version.)
 * --------------------------------------------------------------- */
async function getGpuUsagePercent() {
	try {
		const graphics = await si.graphics();
		const loads = graphics.controllers
			.map((c) => c.utilizationGpu)
			.filter((v) => typeof v === 'number');

		if (loads.length) {
			return loads.reduce((a, b) => a + b, 0) / loads.length;
		}
	} catch {
		/* ignore */
	}
	return 0;
}

async function readIoCounters() {
	try {
		const [disk, net] = await Promise.all([si.fsStats(), si.networkStats()]);

		return {
			diskBytes: (disk.rx || 0) + (disk.wx || 0), // total bytes read + written
			netBytes: net.reduce((sum, n) => sum + (n.rx_bytes || 0) + (n.tx_bytes || 0), 0)
		};
	} catch {
		return { diskBytes: 0, netBytes: 0 };
	}
}

async function estimatePowerGeneric() {
	// CPU % over ~1s (systeminformation computes load since last call)
	await si.currentLoad(); // prime the internal counters
	const ioStart = await readIoCounters();
	await sleep(1000);
	const load = await si.currentLoad();
	const ioEnd = await readIoCounters();

	const cpuPercent = load.currentLoad || 0;
	const diskBytes = Math.max(0, ioEnd.diskBytes - ioStart.diskBytes);
	const netBytes = Math.max(0, ioEnd.netBytes - ioStart.netBytes);
	const gpuPercent = await getGpuUsagePercent();

	const diskWatt = diskBytes / (1024 * 1024 * 10);
	const netWatt = netBytes / (1024 * 1024 * 20);
	const gpuWatt = gpuPercent * 0.2;
	const cpuWatt = cpuPercent * 0.3;

	return {
		power: round2(cpuWatt + diskWatt + netWatt + gpuWatt),
		method: 'Estimated from CPU + Disk + Network + GPU'
	};
}

/* ---------------------------------------------------------------
 * Method selection — mirrors detect_best_power_method()
 * --------------------------------------------------------------- */
async function detectBestPowerMethod() {
	const platform = process.platform;

	if (platform === 'linux') {
		const rapl = await getPowerLinuxRAPL();
		if (rapl && rapl.power) return rapl;

		const battery = getPowerLinuxBattery();
		if (battery && battery.power) return battery;
	} else if (platform === 'win32') {
		const intel = await getPowerWindowsIntel();
		if (intel && intel.power) return intel;
	}

	return estimatePowerGeneric();
}

/* ---------------------------------------------------------------
 * Uptime / energy / CO2 — port of data.py
 * --------------------------------------------------------------- */
const POWER_CONSUMPTION_WATT = 50;
const CO2_EMISSIONS_PER_KWH_INDIA = 0.82;

function getUptimeHours() {
	return os.uptime() / 3600;
}

function getUptimeStats() {
	const uptimeHours = getUptimeHours();
	const energyKwh = (uptimeHours * POWER_CONSUMPTION_WATT) / 1000;
	return {
		uptime: uptimeHours,
		energy_kwh: energyKwh,
		co2_emissions: energyKwh * CO2_EMISSIONS_PER_KWH_INDIA
	};
}

/* ---------------------------------------------------------------
 * Streaming API — replaces stream_power_json()
 * Emits one reading roughly every `intervalMs` (each reading itself
 * takes ~1s to sample, matching the Python behaviour).
 * --------------------------------------------------------------- */
function startPowerStream(onData, intervalMs = 1000) {
	let stopped = false;

	(async () => {
		while (!stopped) {
			try {
				const { power, method } = await detectBestPowerMethod();

				onData({
					timestamp: new Date().toISOString(),
					power_watts: power,
					method,
					uptime_hours: round2(getUptimeHours())
				});
			} catch (err) {
				console.error('Power tracker error:', err);
			}

			await sleep(intervalMs);
		}
	})();

	return {
		stop() {
			stopped = true;
		}
	};
}

module.exports = { startPowerStream, detectBestPowerMethod, getUptimeStats };
