const SUPERVISOR_TOKEN = process.env.SUPERVISOR_TOKEN || process.env.HASSIO_TOKEN;
const HA_URL = 'http://supervisor/core';
const SUPERVISOR_URL = 'http://supervisor';

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
 * Make a request to the Supervisor API (for add-on management, host info, etc.)
 */
async function supervisorRequest(endpoint, options = {}) {
    const url = `${SUPERVISOR_URL}${endpoint}`;

    const response = await fetch(url, {
        ...options,
        headers: {
            'Authorization': `Bearer ${SUPERVISOR_TOKEN}`,
            'Content-Type': 'application/json',
            ...options.headers
        }
    });

    if (!response.ok) {
        throw new Error(`Supervisor API error: ${response.status} ${response.statusText}`);
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

// ============================================
// ADD-ON MONITORING FUNCTIONS
// ============================================

/**
 * Get list of all installed add-ons with their status
 */
async function getAddons() {
    try {
        const response = await supervisorRequest('/addons');
        return response.data?.addons || [];
    } catch (error) {
        console.error('[Add-ons] Failed to get add-on list:', error.message);
        return [];
    }
}

/**
 * Get detailed info for a specific add-on
 */
async function getAddonInfo(slug) {
    try {
        const response = await supervisorRequest(`/addons/${slug}/info`);
        return response.data || null;
    } catch (error) {
        console.error(`[Add-ons] Failed to get info for ${slug}:`, error.message);
        return null;
    }
}

/**
 * Get stats (CPU, memory, network) for a specific add-on
 */
async function getAddonStats(slug) {
    try {
        const response = await supervisorRequest(`/addons/${slug}/stats`);
        return response.data || null;
    } catch (error) {
        console.error(`[Add-ons] Failed to get stats for ${slug}:`, error.message);
        return null;
    }
}

/**
 * Get comprehensive add-on health report for digest analysis
 */
async function getAddonHealthReport() {
    const addons = await getAddons();
    const report = {
        total: addons.length,
        running: 0,
        stopped: 0,
        updateAvailable: 0,
        issues: [],
        addons: []
    };

    for (const addon of addons) {
        const status = {
            name: addon.name,
            slug: addon.slug,
            state: addon.state,
            version: addon.version,
            updateAvailable: addon.update_available || false
        };

        // Count statuses
        if (addon.state === 'started') {
            report.running++;
        } else {
            report.stopped++;
            // Only flag as issue if it was previously started
            if (addon.boot === 'auto') {
                report.issues.push({
                    addon: addon.name,
                    issue: 'Add-on is not running but set to auto-start',
                    severity: 'warning'
                });
            }
        }

        if (addon.update_available) {
            report.updateAvailable++;
        }

        // Try to get stats for running add-ons
        if (addon.state === 'started') {
            const stats = await getAddonStats(addon.slug);
            if (stats) {
                status.cpu_percent = stats.cpu_percent;
                status.memory_percent = stats.memory_percent;
                status.memory_usage = stats.memory_usage;

                // Flag high resource usage
                if (stats.cpu_percent > 80) {
                    report.issues.push({
                        addon: addon.name,
                        issue: `High CPU usage: ${stats.cpu_percent.toFixed(1)}%`,
                        severity: 'warning'
                    });
                }
                if (stats.memory_percent > 80) {
                    report.issues.push({
                        addon: addon.name,
                        issue: `High memory usage: ${stats.memory_percent.toFixed(1)}%`,
                        severity: 'warning'
                    });
                }
            }
        }

        report.addons.push(status);
    }

    return report;
}

/**
 * Get host system info (OS, disk, etc.)
 */
async function getHostInfo() {
    try {
        const response = await supervisorRequest('/host/info');
        return response.data || null;
    } catch (error) {
        console.error('[Host] Failed to get host info:', error.message);
        return null;
    }
}

/**
 * Get core system info (HA version, etc.)
 */
async function getSupervisorInfo() {
    try {
        const response = await supervisorRequest('/supervisor/info');
        return response.data || null;
    } catch (error) {
        console.error('[Supervisor] Failed to get supervisor info:', error.message);
        return null;
    }
}

module.exports = {
    haRequest,
    supervisorRequest,
    getAllStates,
    getState,
    getHistory,
    callService,
    getConfig,
    sendNotification,
    checkConnection,
    categorizeEntity,
    determineStorageStrategy,
    determinePriority,
    // Add-on monitoring
    getAddons,
    getAddonInfo,
    getAddonStats,
    getAddonHealthReport,
    getHostInfo,
    getSupervisorInfo
};
