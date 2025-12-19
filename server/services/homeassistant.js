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

// ============================================
// AUTOMATION & SCRIPT HEALTH FUNCTIONS
// ============================================

/**
 * Get automation health report - disabled automations, recently triggered, etc.
 */
async function getAutomationHealthReport() {
    try {
        const states = await getAllStates();
        const automations = states.filter(e => e.entity_id.startsWith('automation.'));

        const report = {
            total: automations.length,
            enabled: 0,
            disabled: 0,
            issues: [],
            automations: []
        };

        for (const auto of automations) {
            const info = {
                name: auto.attributes.friendly_name || auto.entity_id,
                entity_id: auto.entity_id,
                state: auto.state, // 'on' = enabled, 'off' = disabled
                last_triggered: auto.attributes.last_triggered || null
            };

            if (auto.state === 'on') {
                report.enabled++;
            } else {
                report.disabled++;
            }

            // Check for automations that haven't run in a long time but are enabled
            if (auto.state === 'on' && auto.attributes.last_triggered) {
                const lastRun = new Date(auto.attributes.last_triggered);
                const daysSinceRun = (Date.now() - lastRun.getTime()) / (1000 * 60 * 60 * 24);

                // Flag automations that haven't run in 30+ days
                if (daysSinceRun > 30) {
                    report.issues.push({
                        name: info.name,
                        issue: `Hasn't triggered in ${Math.floor(daysSinceRun)} days`,
                        severity: 'info'
                    });
                }
            }

            report.automations.push(info);
        }

        return report;
    } catch (error) {
        console.error('[Automations] Failed to get automation health:', error.message);
        return { total: 0, enabled: 0, disabled: 0, issues: [], automations: [] };
    }
}

/**
 * Get system update report - checks for available updates to HA Core, OS, Supervisor, and add-ons
 */
async function getUpdateReport() {
    const report = {
        hasUpdates: false,
        updates: [],
        summary: ''
    };

    try {
        // Get Core update info
        const coreInfo = await supervisorRequest('/core/info');
        if (coreInfo.data) {
            const core = coreInfo.data;
            if (core.update_available) {
                report.hasUpdates = true;
                report.updates.push({
                    name: 'Home Assistant Core',
                    type: 'core',
                    current: core.version,
                    available: core.version_latest,
                    severity: 'info'
                });
            }
        }

        // Get Supervisor update info
        const supInfo = await supervisorRequest('/supervisor/info');
        if (supInfo.data) {
            const sup = supInfo.data;
            if (sup.update_available) {
                report.hasUpdates = true;
                report.updates.push({
                    name: 'Home Assistant Supervisor',
                    type: 'supervisor',
                    current: sup.version,
                    available: sup.version_latest,
                    severity: 'info'
                });
            }
        }

        // Get OS update info
        const osInfo = await supervisorRequest('/os/info');
        if (osInfo.data) {
            const os = osInfo.data;
            if (os.update_available) {
                report.hasUpdates = true;
                report.updates.push({
                    name: 'Home Assistant OS',
                    type: 'os',
                    current: os.version,
                    available: os.version_latest,
                    severity: 'info'
                });
            }
        }

        // Add-on updates are already covered in getAddonHealthReport
        // But we can summarize here
        const addons = await getAddons();
        const addonUpdates = addons.filter(a => a.update_available);
        if (addonUpdates.length > 0) {
            report.hasUpdates = true;
            for (const addon of addonUpdates.slice(0, 5)) { // Limit to 5 to avoid noise
                report.updates.push({
                    name: addon.name,
                    type: 'addon',
                    current: addon.version,
                    available: addon.version_latest,
                    severity: 'info'
                });
            }
            if (addonUpdates.length > 5) {
                report.updates.push({
                    name: `...and ${addonUpdates.length - 5} more add-ons`,
                    type: 'addon',
                    severity: 'info'
                });
            }
        }

        // Build summary
        if (report.updates.length === 0) {
            report.summary = 'All components are up to date.';
        } else {
            const coreUpdate = report.updates.find(u => u.type === 'core');
            if (coreUpdate) {
                report.summary = `Home Assistant ${coreUpdate.available} is available (current: ${coreUpdate.current}). `;
            }
            report.summary += `${report.updates.length} update(s) available.`;
        }

        console.log(`[Updates] ${report.updates.length} updates available`);

    } catch (error) {
        console.error('[Updates] Failed to check for updates:', error.message);
        report.summary = 'Unable to check for updates.';
    }

    return report;
}

/**
 * Get recently failed automations by checking automation traces
 * This looks for automations that triggered but encountered errors
 */
async function getFailedAutomations() {
    const report = {
        failures: [],
        checked: 0
    };

    try {
        // Get all automation states first
        const states = await getAllStates();
        const automations = states.filter(e => e.entity_id.startsWith('automation.'));

        // Check traces for each automation that has triggered recently
        for (const auto of automations) {
            if (!auto.attributes.last_triggered) continue;

            const lastTriggered = new Date(auto.attributes.last_triggered);
            const hoursSinceRun = (Date.now() - lastTriggered.getTime()) / (1000 * 60 * 60);

            // Only check automations that ran in the last 24 hours
            if (hoursSinceRun > 24) continue;

            report.checked++;

            try {
                // Get traces for this automation
                const tracesResponse = await haRequest('/api/trace/automation/' + auto.entity_id.split('.')[1]);
                const traces = Array.isArray(tracesResponse) ? tracesResponse : [];

                // Check the most recent traces for errors
                for (const trace of traces.slice(0, 3)) { // Check last 3 traces
                    if (trace.state === 'stopped' && trace.script_execution === 'error') {
                        const traceTime = new Date(trace.timestamp);
                        const hoursAgo = (Date.now() - traceTime.getTime()) / (1000 * 60 * 60);

                        // Only report failures from last 24 hours
                        if (hoursAgo <= 24) {
                            report.failures.push({
                                name: auto.attributes.friendly_name || auto.entity_id,
                                entity_id: auto.entity_id,
                                error_time: trace.timestamp,
                                hours_ago: Math.round(hoursAgo),
                                error: trace.error || 'Unknown error'
                            });
                            break; // Only report most recent failure per automation
                        }
                    }
                }
            } catch (traceError) {
                // Trace API might not be available for all automations, skip silently
            }
        }

        console.log(`[Automations] Checked ${report.checked} automations, found ${report.failures.length} failures`);

    } catch (error) {
        console.error('[Automations] Failed to check automation traces:', error.message);
    }

    return report;
}

/**
 * Get integration/config entry status
 */
async function getIntegrationHealthReport() {
    try {
        // Get config entries via API
        const response = await haRequest('/api/config/config_entries/entry');
        const entries = Array.isArray(response) ? response : [];

        const report = {
            total: entries.length,
            loaded: 0,
            failed: 0,
            issues: [],
            integrations: []
        };

        for (const entry of entries) {
            const info = {
                title: entry.title || entry.domain,
                domain: entry.domain,
                state: entry.state, // 'loaded', 'setup_error', 'setup_retry', 'not_loaded', etc.
            };

            // Count by state
            if (entry.state === 'loaded') {
                report.loaded++;
            } else if (entry.state === 'not_loaded' || entry.disabled_by) {
                // Intentionally disabled/ignored - don't count as failed
                report.loaded++; // Count as okay
            } else {
                report.failed++;

                // Only add to issues if it's a real error (not intentionally disabled)
                const errorStates = {
                    'setup_error': 'Setup failed',
                    'setup_retry': 'Retrying setup',
                    'failed_unload': 'Failed to unload',
                    'migration_error': 'Migration error'
                };

                if (errorStates[entry.state]) {
                    report.issues.push({
                        name: info.title,
                        domain: entry.domain,
                        issue: errorStates[entry.state],
                        severity: entry.state === 'setup_error' ? 'warning' : 'info'
                    });
                }
            }

            report.integrations.push(info);
        }

        return report;
    } catch (error) {
        console.error('[Integrations] Failed to get integration health:', error.message);
        return { total: 0, loaded: 0, failed: 0, issues: [], integrations: [] };
    }
}

// ============================================
// LOG ANALYSIS FUNCTIONS
// ============================================

/**
 * Make a request for plain text logs (not JSON)
 */
async function supervisorLogRequest(endpoint, lines = 100) {
    const url = `${SUPERVISOR_URL}${endpoint}`;

    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${SUPERVISOR_TOKEN}`,
            'Accept': 'text/plain',
            'Range': `entries=:-${lines}:` // Get last N entries
        }
    });

    if (!response.ok) {
        throw new Error(`Supervisor Log API error: ${response.status} ${response.statusText}`);
    }

    return response.text();
}

/**
 * Get Home Assistant Core logs
 */
async function getCoreLogs(lines = 200) {
    try {
        const logs = await supervisorLogRequest('/core/logs', lines);
        return logs;
    } catch (error) {
        console.error('[Logs] Failed to get core logs:', error.message);
        return null;
    }
}

/**
 * Get Supervisor logs
 */
async function getSupervisorLogs(lines = 100) {
    try {
        const logs = await supervisorLogRequest('/supervisor/logs', lines);
        return logs;
    } catch (error) {
        console.error('[Logs] Failed to get supervisor logs:', error.message);
        return null;
    }
}

/**
 * Get add-on logs
 */
async function getAddonLogs(slug, lines = 100) {
    try {
        const logs = await supervisorLogRequest(`/addons/${slug}/logs`, lines);
        return logs;
    } catch (error) {
        console.error(`[Logs] Failed to get logs for ${slug}:`, error.message);
        return null;
    }
}

/**
 * Analyze logs for errors, warnings, and notable events
 */
function analyzeLogContent(logText, source = 'unknown') {
    if (!logText) return { errors: [], warnings: [], notable: [] };

    const lines = logText.split('\n').filter(line => line.trim());
    const errors = [];
    const warnings = [];
    const notable = [];

    // Patterns to look for
    const errorPatterns = [
        /\bERROR\b/i,
        /\bException\b/,
        /\bFailed\b/i,
        /\bCritical\b/i,
        /\bFatal\b/i
    ];

    const warningPatterns = [
        /\bWARNING\b/i,
        /\bWARN\b/i,
        /\bDeprecated\b/i,
        /\bTimeout\b/i,
        /\bRetrying\b/i
    ];

    const notablePatterns = [
        /\bRestarting\b/i,
        /\bStopped\b/i,
        /\bStarted\b/i,
        /\bUpdating\b/i,
        /\bMigrating\b/i
    ];

    // Track unique messages to avoid duplicates
    const seenErrors = new Set();
    const seenWarnings = new Set();

    for (const line of lines) {
        // Skip empty or very short lines
        if (line.length < 10) continue;

        // Extract a simplified message (first 150 chars)
        const simplifiedMsg = line.substring(0, 150).trim();

        // Check for errors
        if (errorPatterns.some(p => p.test(line))) {
            // Create a dedup key from the first part of the message
            const dedupKey = simplifiedMsg.substring(0, 80);
            if (!seenErrors.has(dedupKey) && errors.length < 10) {
                seenErrors.add(dedupKey);
                errors.push({
                    source,
                    message: simplifiedMsg,
                    full: line.substring(0, 500)
                });
            }
        }
        // Check for warnings
        else if (warningPatterns.some(p => p.test(line))) {
            const dedupKey = simplifiedMsg.substring(0, 80);
            if (!seenWarnings.has(dedupKey) && warnings.length < 10) {
                seenWarnings.add(dedupKey);
                warnings.push({
                    source,
                    message: simplifiedMsg
                });
            }
        }
        // Check for notable events
        else if (notablePatterns.some(p => p.test(line)) && notable.length < 5) {
            notable.push({
                source,
                message: simplifiedMsg
            });
        }
    }

    return { errors, warnings, notable };
}

/**
 * Get comprehensive log health report for digest analysis
 */
async function getLogHealthReport() {
    const report = {
        errors: [],
        warnings: [],
        notable: [],
        summary: '',
        analyzed: false
    };

    try {
        // Get core logs (most important)
        const coreLogs = await getCoreLogs(300);
        if (coreLogs) {
            const coreAnalysis = analyzeLogContent(coreLogs, 'Home Assistant Core');
            report.errors.push(...coreAnalysis.errors);
            report.warnings.push(...coreAnalysis.warnings);
            report.notable.push(...coreAnalysis.notable);
        }

        // Get supervisor logs
        const supervisorLogs = await getSupervisorLogs(100);
        if (supervisorLogs) {
            const supAnalysis = analyzeLogContent(supervisorLogs, 'Supervisor');
            report.errors.push(...supAnalysis.errors);
            report.warnings.push(...supAnalysis.warnings);
        }

        // Limit to top issues
        report.errors = report.errors.slice(0, 10);
        report.warnings = report.warnings.slice(0, 10);
        report.notable = report.notable.slice(0, 5);

        // Build summary
        if (report.errors.length === 0 && report.warnings.length === 0) {
            report.summary = 'No significant errors or warnings found in logs.';
        } else {
            report.summary = `Found ${report.errors.length} errors and ${report.warnings.length} warnings in logs.`;
        }

        report.analyzed = true;
        console.log(`[Logs] Analysis complete: ${report.errors.length} errors, ${report.warnings.length} warnings`);

    } catch (error) {
        console.error('[Logs] Failed to analyze logs:', error.message);
        report.summary = 'Unable to analyze logs - may require additional permissions.';
    }

    return report;
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
    getSupervisorInfo,
    // Automation & Integration health
    getAutomationHealthReport,
    getIntegrationHealthReport,
    // Updates & failed automations
    getUpdateReport,
    getFailedAutomations,
    // Log analysis
    getCoreLogs,
    getSupervisorLogs,
    getAddonLogs,
    getLogHealthReport
};
