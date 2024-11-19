import psutil
import time
from datetime import timedelta
import json

# Constants
POWER_CONSUMPTION_WATT = 50
CO2_EMISSIONS_PER_KWH_INDIA = 0.82

def get_uptime():
    boot_time_timestamp = psutil.boot_time()
    boot_time = time.time() - boot_time_timestamp
    return boot_time / 3600  # Uptime in hours

def calculate_energy_usage(uptime_hours):
    energy_used_wh = uptime_hours * POWER_CONSUMPTION_WATT
    return energy_used_wh / 1000  # Convert to kWh

def calculate_carbon_footprint(energy_kwh):
    return energy_kwh * CO2_EMISSIONS_PER_KWH_INDIA

if __name__ == '__main__':
    uptime_hours = get_uptime()
    energy_kwh = calculate_energy_usage(uptime_hours)
    co2_emissions = calculate_carbon_footprint(energy_kwh)

    # Output the data as JSON
    data = {
        "uptime": uptime_hours,
        "energy_kwh": energy_kwh,
        "co2_emissions": co2_emissions,
    }
    print(json.dumps(data))
