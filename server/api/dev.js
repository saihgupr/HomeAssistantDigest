const express = require('express');
const router = express.Router();
const { setMonitoredEntities, clearMonitoredEntities, getTotalCounts } = require('../db/entities');
const { addSnapshots, getSnapshotStats } = require('../db/snapshots');
const { setProfileValue } = require('../db/profile');

/**
 * POST /api/dev/seed
 * Seed the database with mock data for local development
 */
router.post('/seed', async (req, res) => {
    try {
        console.log('Seeding mock data for development...');

        // 1. Set up a mock profile
        setProfileValue('occupants', { adults: 2, children: 1, pets: 'dog' });
        setProfileValue('schedule', {
            wake: '07:00',
            leave: '08:30',
            return: '17:30',
            sleep: '22:30',
            workFromHome: ['monday', 'friday']
        });
        setProfileValue('priorities', ['comfort', 'energy', 'security']);
        setProfileValue('concerns', 'High CPU usage on some add-ons, want to optimize energy usage');
        setProfileValue('setup_complete', true);

        // 2. Create mock monitored entities
        clearMonitoredEntities();

        const mockEntities = [
            // Climate
            { entity_id: 'sensor.living_room_temperature', friendly_name: 'Living Room Temperature', domain: 'sensor', category: 'climate', priority: 'normal', storage_strategy: 'hourly_avg' },
            { entity_id: 'sensor.bedroom_temperature', friendly_name: 'Bedroom Temperature', domain: 'sensor', category: 'climate', priority: 'normal', storage_strategy: 'hourly_avg' },
            { entity_id: 'sensor.outdoor_temperature', friendly_name: 'Outdoor Temperature', domain: 'sensor', category: 'climate', priority: 'low', storage_strategy: 'hourly_avg' },
            { entity_id: 'sensor.living_room_humidity', friendly_name: 'Living Room Humidity', domain: 'sensor', category: 'climate', priority: 'low', storage_strategy: 'hourly_avg' },
            { entity_id: 'climate.thermostat', friendly_name: 'Main Thermostat', domain: 'climate', category: 'climate', priority: 'critical', storage_strategy: 'hourly_snapshot' },

            // Energy
            { entity_id: 'sensor.power_consumption', friendly_name: 'Total Power Consumption', domain: 'sensor', category: 'energy', priority: 'normal', storage_strategy: 'hourly_sum' },
            { entity_id: 'sensor.solar_production', friendly_name: 'Solar Production', domain: 'sensor', category: 'energy', priority: 'normal', storage_strategy: 'hourly_sum' },
            { entity_id: 'sensor.grid_import', friendly_name: 'Grid Import', domain: 'sensor', category: 'energy', priority: 'low', storage_strategy: 'hourly_sum' },

            // Security
            { entity_id: 'binary_sensor.front_door', friendly_name: 'Front Door', domain: 'binary_sensor', category: 'security', priority: 'critical', storage_strategy: 'daily_summary' },
            { entity_id: 'binary_sensor.back_door', friendly_name: 'Back Door', domain: 'binary_sensor', category: 'security', priority: 'critical', storage_strategy: 'daily_summary' },
            { entity_id: 'binary_sensor.motion_hallway', friendly_name: 'Hallway Motion', domain: 'binary_sensor', category: 'security', priority: 'normal', storage_strategy: 'daily_summary' },
            { entity_id: 'lock.front_door', friendly_name: 'Front Door Lock', domain: 'lock', category: 'security', priority: 'critical', storage_strategy: 'daily_snapshot' },

            // Lighting
            { entity_id: 'light.living_room', friendly_name: 'Living Room Lights', domain: 'light', category: 'lighting', priority: 'low', storage_strategy: 'daily_snapshot' },
            { entity_id: 'light.bedroom', friendly_name: 'Bedroom Lights', domain: 'light', category: 'lighting', priority: 'low', storage_strategy: 'daily_snapshot' },

            // Appliances
            { entity_id: 'binary_sensor.washing_machine', friendly_name: 'Washing Machine', domain: 'binary_sensor', category: 'appliance', priority: 'low', storage_strategy: 'daily_summary' },
            { entity_id: 'sensor.dishwasher_status', friendly_name: 'Dishwasher', domain: 'sensor', category: 'appliance', priority: 'low', storage_strategy: 'daily_snapshot' },
        ];

        setMonitoredEntities(mockEntities);

        // 3. Generate mock snapshots for the past 24 hours
        const now = new Date();
        const snapshots = [];

        // Generate hourly data for temperature sensors
        for (let hoursAgo = 24; hoursAgo >= 0; hoursAgo--) {
            const timestamp = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000).toISOString();

            // Living room temp: 20-23°C with daily pattern
            const hour = new Date(timestamp).getHours();
            const livingTemp = 21 + Math.sin(hour / 24 * Math.PI * 2) * 1.5 + (Math.random() - 0.5);
            snapshots.push({
                entity_id: 'sensor.living_room_temperature',
                timestamp,
                value_type: 'number',
                value_num: Math.round(livingTemp * 10) / 10,
                value_str: null,
                attributes: { unit_of_measurement: '°C' }
            });

            // Bedroom temp: slightly cooler
            const bedroomTemp = livingTemp - 1 + (Math.random() - 0.5);
            snapshots.push({
                entity_id: 'sensor.bedroom_temperature',
                timestamp,
                value_type: 'number',
                value_num: Math.round(bedroomTemp * 10) / 10,
                value_str: null,
                attributes: { unit_of_measurement: '°C' }
            });

            // Outdoor temp: wider range
            const outdoorTemp = 5 + Math.sin(hour / 24 * Math.PI * 2) * 8 + (Math.random() - 0.5) * 2;
            snapshots.push({
                entity_id: 'sensor.outdoor_temperature',
                timestamp,
                value_type: 'number',
                value_num: Math.round(outdoorTemp * 10) / 10,
                value_str: null,
                attributes: { unit_of_measurement: '°C' }
            });

            // Power consumption: higher during day
            const basePower = hour >= 7 && hour <= 22 ? 800 : 300;
            const power = basePower + Math.random() * 500;
            snapshots.push({
                entity_id: 'sensor.power_consumption',
                timestamp,
                value_type: 'number',
                value_num: Math.round(power),
                value_str: null,
                attributes: { unit_of_measurement: 'W' }
            });

            // Solar production: only during daylight
            const solar = hour >= 8 && hour <= 17 ? Math.sin((hour - 8) / 9 * Math.PI) * 3000 : 0;
            snapshots.push({
                entity_id: 'sensor.solar_production',
                timestamp,
                value_type: 'number',
                value_num: Math.round(solar * (0.8 + Math.random() * 0.4)),
                value_str: null,
                attributes: { unit_of_measurement: 'W' }
            });
        }

        // Add some door open/close events
        const doorEvents = [
            { hoursAgo: 18, state: 'on' },  // Morning departure
            { hoursAgo: 17.9, state: 'off' },
            { hoursAgo: 8, state: 'on' },   // Return home
            { hoursAgo: 7.9, state: 'off' },
            { hoursAgo: 2, state: 'on' },   // Evening
            { hoursAgo: 1.9, state: 'off' },
        ];

        for (const event of doorEvents) {
            const timestamp = new Date(now.getTime() - event.hoursAgo * 60 * 60 * 1000).toISOString();
            snapshots.push({
                entity_id: 'binary_sensor.front_door',
                timestamp,
                value_type: 'state',
                value_num: null,
                value_str: event.state,
                attributes: { device_class: 'door' }
            });
        }

        addSnapshots(snapshots);

        const entityCounts = getTotalCounts();
        const snapshotStats = getSnapshotStats();

        console.log(`Seeded ${entityCounts.total} entities and ${snapshotStats.total_snapshots} snapshots`);

        res.json({
            success: true,
            message: 'Mock data seeded successfully',
            entities: entityCounts,
            snapshots: snapshotStats
        });
    } catch (error) {
        console.error('Seed error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/dev/clear
 * Clear all mock data
 */
router.post('/clear', async (req, res) => {
    try {
        const { getDb, saveDatabase } = require('../db');
        const db = getDb();

        db.run('DELETE FROM snapshots');
        db.run('DELETE FROM monitored_entities');
        db.run('DELETE FROM digests');
        db.run('DELETE FROM profile');
        saveDatabase();

        res.json({ success: true, message: 'All data cleared' });
    } catch (error) {
        console.error('Clear error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
