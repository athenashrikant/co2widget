import os
import platform
import time
import json
import psutil
from datetime import datetime

def read_file(path):
    try:
        with open(path, 'r') as f:
            return int(f.read().strip())
    except:
        return None

def get_power_linux_intel():
    try:
        import pyRAPL
        pyRAPL.setup()
        meter = pyRAPL.Measurement('rapl')
        meter.begin()
        time.sleep(1)
        meter.end()
        microjoules = meter.result.pkg
        watts = microjoules / 1_000_000
        return round(watts, 2), "Intel RAPL (pyRAPL)"
    except:
        return None, None

def get_power_linux_battery():
    current_now = read_file('/sys/class/power_supply/BAT0/current_now')
    voltage_now = read_file('/sys/class/power_supply/BAT0/voltage_now')
    if current_now and voltage_now:
        current = current_now / 1_000_000
        voltage = voltage_now / 1_000_000
        power = current * voltage
        return round(power, 2), "Battery voltage × current"
    return None, None

def get_power_windows_intel():
    possible_paths = [
        'PowerLog3.0.exe',
        r'C:\Program Files\Intel\Power Gadget 3.0\PowerLog3.0.exe',
        r'C:\Program Files (x86)\Intel\Power Gadget 3.0\PowerLog3.0.exe'
    ]
    for path in possible_paths:
        if os.path.exists(path):
            try:
                cmd = f'"{path}" -resolution 1 -duration 1'
                output = os.popen(cmd).read()
                for line in output.splitlines():
                    if "Total Package Power" in line:
                        power = float(line.split(',')[-1])
                        return round(power, 2), "Intel Power Gadget"
            except:
                pass
    return None, None

def get_gpu_usage():
    try:
        import GPUtil
        gpus = GPUtil.getGPUs()
        if gpus:
            return sum(gpu.load for gpu in gpus) / len(gpus) * 100  # average GPU % load
    except:
        pass
    return 0

def estimate_power_generic():
    cpu_percent = psutil.cpu_percent(interval=1)

    try:
        disk_io_start = psutil.disk_io_counters()
        net_io_start = psutil.net_io_counters()
        time.sleep(1)
        disk_io_end = psutil.disk_io_counters()
        net_io_end = psutil.net_io_counters()

        disk_bytes = (disk_io_end.read_bytes + disk_io_end.write_bytes) - \
                     (disk_io_start.read_bytes + disk_io_start.write_bytes)
        net_bytes = (net_io_end.bytes_sent + net_io_end.bytes_recv) - \
                    (net_io_start.bytes_sent + net_io_start.bytes_recv)
    except:
        disk_bytes = 0
        net_bytes = 0

    gpu_percent = get_gpu_usage()

    disk_watt = disk_bytes / (1024 * 1024 * 10)  # ~0.1 W per 10MB/s
    net_watt = net_bytes / (1024 * 1024 * 20)    # ~0.05 W per 20MB/s
    gpu_watt = gpu_percent * 0.2                 # ~0.2 W per % load (adjustable)

    power = (cpu_percent * 0.3) + disk_watt + net_watt + gpu_watt
    return round(power, 2), "Estimated from CPU + Disk + Network + GPU activity"

def detect_best_power_method():
    os_type = platform.system()
    if os_type == 'Linux':
        power, method = get_power_linux_intel()
        if power: return power, method
        power, method = get_power_linux_battery()
        if power: return power, method
    elif os_type == 'Windows':
        power, method = get_power_windows_intel()
        if power: return power, method
    return estimate_power_generic()

def track_power():
    print("🔋 Tracking real-time power usage (adaptive)... Press Ctrl+C to stop.\n")
    try:
        while True:
            power, method = detect_best_power_method()
            data = {
                "timestamp": datetime.now().isoformat(),
                "power_watts": power,
                "method": method
            }
            print(json.dumps(data, indent=2))
    except KeyboardInterrupt:
        print("\n🛑 Stopped tracking.")

if __name__ == "__main__":
    track_power()
