/**
 * Predictions Service - Battery depletion and trend analysis
 */

const { getDb } = require('../db/index');

/**
 * Calculate battery predictions for all battery sensors
 * Uses linear regression on last 7 days of snapshots to estimate drain rate
 */
async function getBatteryPredictions() {
    const db = getDb();

    // Find battery entities (by category or entity_id pattern)
    const batteryEntities = db.exec(`
        SELECT entity_id, friendly_name, category
        FROM monitored_entities
        WHERE (category = 'power' OR entity_id LIKE '%battery%')
          AND priority != 'ignore'
    `);

    if (batteryEntities.length === 0) return [];

    const predictions = [];
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    for (const row of batteryEntities[0].values) {
        const [entityId, friendlyName] = row;

        // Get snapshots for this battery
        const snapshots = db.exec(`
            SELECT timestamp, value_num
            FROM snapshots
            WHERE entity_id = ?
              AND value_num IS NOT NULL
              AND timestamp >= ?
              AND timestamp <= ?
            ORDER BY timestamp ASC
        `, [entityId, sevenDaysAgo, now]);

        if (snapshots.length === 0 || snapshots[0].values.length < 2) {
            continue; // Need at least 2 data points
        }

        const dataPoints = snapshots[0].values.map(([ts, val]) => ({
            timestamp: new Date(ts).getTime(),
            value: val
        }));

        // Skip if values aren't in battery percentage range (0-100)
        const latestValue = dataPoints[dataPoints.length - 1].value;
        if (latestValue < 0 || latestValue > 100) continue;

        // Calculate linear regression
        const regression = linearRegression(dataPoints);

        // drain_rate is negative slope (% per day)
        const drainRatePerDay = -regression.slope * (24 * 60 * 60 * 1000);

        // Skip if battery is charging or stable (not draining)
        if (drainRatePerDay <= 0.01) continue;

        // Calculate days until 10% threshold
        const daysRemaining = latestValue > 10
            ? Math.round((latestValue - 10) / drainRatePerDay)
            : 0;

        predictions.push({
            entity_id: entityId,
            friendly_name: friendlyName,
            current_level: Math.round(latestValue),
            drain_rate_per_day: Math.round(drainRatePerDay * 10) / 10,
            days_remaining: daysRemaining,
            data_points: dataPoints.length,
            needs_attention: daysRemaining > 0 && daysRemaining <= 30
        });
    }

    // Sort by days remaining (most urgent first)
    predictions.sort((a, b) => a.days_remaining - b.days_remaining);

    return predictions;
}

/**
 * Simple linear regression to find slope (drain rate)
 * Returns { slope, intercept }
 */
function linearRegression(points) {
    const n = points.length;
    if (n === 0) return { slope: 0, intercept: 0 };

    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

    // Normalize timestamps to start from 0 for numerical stability
    const t0 = points[0].timestamp;

    for (const p of points) {
        const x = p.timestamp - t0;
        const y = p.value;
        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumX2 += x * x;
    }

    const denominator = n * sumX2 - sumX * sumX;
    if (denominator === 0) return { slope: 0, intercept: sumY / n };

    const slope = (n * sumXY - sumX * sumY) / denominator;
    const intercept = (sumY - slope * sumX) / n;

    return { slope, intercept };
}

module.exports = {
    getBatteryPredictions
};
