const SUPERVISOR_TOKEN = process.env.SUPERVISOR_TOKEN || process.env.HASSIO_TOKEN;
const HA_URL = 'http://supervisor/core';

/**
 * Make a request to the Home Assistant API
 */
async function haRequest(endpoint, options = {}) {
    const url = `${HA_URL}${endpoint}`;

    console.log(`[HA Request] Making request to: ${url}`);
    if (!SUPERVISOR_TOKEN) {
        console.error('[HA Request] SUPERVISOR_TOKEN is missing!');
    } else {
        console.log(`[HA Request] Token present (length: ${SUPERVISOR_TOKEN.length})`);
    }

    const response = await fetch(url, {
        ...options,
        headers: {
            'Authorization': `Bearer ${SUPERVISOR_TOKEN}`,
            'Content-Type': 'application/json',
            ...options.headers
        }
    });

    if (!response.ok) {
        throw new Error(`HA API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
}

/**
 * Get all entity states from Home Assistant
 */
async function getAllStates() {
    return haRequest('/api/states');
}

/**
 * Get a single entity's state
 */
async function getState(entityId) {
    return haRequest(`/api/states/${entityId}`);
}

/**
 * Get entity history for a time period
 */
async function getHistory(entityId, startTime, endTime) {
    const params = new URLSearchParams({
        filter_entity_id: entityId
    });
    if (endTime) {
        params.set('end_time', endTime);
    }
    return haRequest(`/api/history/period/${startTime}?${params}`);
}

/**
 * Call a Home Assistant service
 */
async function callService(domain, service, data = {}) {
    return haRequest(`/api/services/${domain}/${service}`, {
        method: 'POST',
        body: JSON.stringify(data)
    });
}

/**
 * Get Home Assistant config (areas, devices info)
 */
async function getConfig() {
    return haRequest('/api/config');
}

/**
 * Send a notification via Home Assistant
 */
async function sendNotification(service, message, title, data = {}) {
    const [domain, serviceName] = service.includes('.')
        ? service.split('.')
        : ['notify', service];

    return callService(domain, serviceName, {
        message,
        title,
        data
    });
}

/**
 * Check if we can connect to Home Assistant
 */
async function checkConnection() {
    try {
        const config = await getConfig();
        return {
            connected: true,
            version: config.version,
            location_name: config.location_name
        };
    } catch (error) {
        return {
            connected: false,
            error: error.message
        };
    }
}

/**
 * Categorize an entity based on its domain and attributes
 */
function categorizeEntity(entity) {
    const domain = entity.entity_id.split('.')[0];
    const attrs = entity.attributes || {};

    // Category mapping based on domain
    const categoryMap = {
        'climate': 'climate',
        'weather': 'climate',
        'humidifier': 'climate',
        'fan': 'climate',
        'light': 'lighting',
        'switch': 'controls',
        'input_boolean': 'controls',
        'button': 'controls',
        'lock': 'security',
        'alarm_control_panel': 'security',
        'binary_sensor': determineBinarySensorCategory(attrs),
        'sensor': determineSensorCategory(attrs),
        'camera': 'security',
        'cover': 'controls',
        'media_player': 'media',
        'vacuum': 'appliances',
        'water_heater': 'climate',
        'device_tracker': 'presence',
        'person': 'presence',
        'automation': 'system',
        'script': 'system',
        'scene': 'system',
        'zone': 'system',
        'input_number': 'system',
        'input_text': 'system',
        'input_select': 'system',
        'input_datetime': 'system',
        'timer': 'system',
        'counter': 'system',
        'group': 'system',
        'sun': 'environment',
        'moon': 'environment'
    };

    return categoryMap[domain] || 'other';
}

/**
 * Determine category for binary sensors based on device class
 */
function determineBinarySensorCategory(attrs) {
    const deviceClass = attrs.device_class;
    const securityClasses = ['door', 'window', 'motion', 'occupancy', 'lock', 'safety', 'tamper', 'smoke', 'gas', 'carbon_monoxide'];
    const climateClasses = ['cold', 'heat', 'moisture', 'humidity'];
    const powerClasses = ['battery', 'battery_charging', 'plug', 'power'];

    if (securityClasses.includes(deviceClass)) return 'security';
    if (climateClasses.includes(deviceClass)) return 'climate';
    if (powerClasses.includes(deviceClass)) return 'energy';

    return 'sensors';
}

/**
 * Determine category for sensors based on device class or unit
 */
function determineSensorCategory(attrs) {
    const deviceClass = attrs.device_class;
    const unit = attrs.unit_of_measurement;

    const climateClasses = ['temperature', 'humidity', 'pressure', 'atmospheric_pressure'];
    const energyClasses = ['energy', 'power', 'power_factor', 'voltage', 'current', 'battery'];

    if (climateClasses.includes(deviceClass)) return 'climate';
    if (energyClasses.includes(deviceClass)) return 'energy';
    if (unit === 'kWh' || unit === 'W' || unit === 'Wh') return 'energy';
    if (unit === '°C' || unit === '°F' || unit === '%' && deviceClass === 'humidity') return 'climate';

    return 'sensors';
}

/**
 * Determine storage strategy based on entity characteristics
 */
function determineStorageStrategy(entity) {
    const domain = entity.entity_id.split('.')[0];
    const attrs = entity.attributes || {};
    const state = entity.state;

    // Numeric values that change frequently - use hourly averages
    if (domain === 'sensor') {
        const numState = parseFloat(state);
        if (!isNaN(numState)) {
            // Energy sensors use hourly sum
            if (attrs.device_class === 'energy' || attrs.unit_of_measurement === 'kWh') {
                return 'hourly_sum';
            }
            return 'hourly_avg';
        }
    }

    // Climate entities - hourly averages
    if (['climate', 'weather', 'humidifier'].includes(domain)) {
        return 'hourly_avg';
    }

    // Binary sensors - daily summary (open count, time open, etc.)
    if (domain === 'binary_sensor') {
        return 'daily_summary';
    }

    // Everything else - daily snapshot
    return 'daily_snapshot';
}

/**
 * Determine priority based on category and attributes
 */
function determinePriority(entity, category) {
    const domain = entity.entity_id.split('.')[0];
    const attrs = entity.attributes || {};

    // Critical priority for security and safety
    if (category === 'security') return 'critical';
    if (attrs.device_class === 'smoke' || attrs.device_class === 'gas' || attrs.device_class === 'carbon_monoxide') {
        return 'critical';
    }

    // High priority for climate (comfort) and energy monitoring
    if (category === 'climate' || category === 'energy') return 'normal';

    // Low priority for system entities and automations
    if (category === 'system') return 'low';

    // Ignore internal/helper entities by default
    if (domain.startsWith('input_') || domain === 'automation' || domain === 'script') {
        return 'ignore';
    }

    return 'normal';
}

module.exports = {
    haRequest,
    getAllStates,
    getState,
    getHistory,
    callService,
    getConfig,
    sendNotification,
    checkConnection,
    categorizeEntity,
    determineStorageStrategy,
    determinePriority
};
