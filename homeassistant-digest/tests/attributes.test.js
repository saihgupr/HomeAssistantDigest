const assert = require('node:assert');
const { extractRelevantAttributes } = require('../server/services/collector');
const { formatAttributes } = require('../server/services/analyzer');

// The entity from issue #5 (Versatile Thermostat over a switch).
const vtherm = {
    current_temperature: 22.9,
    temperature: 22.7,
    hvac_action: 'idle',
    ema_temp: 22.85,
    power_percent: 0,
    on_percent: 0,
    preset_mode: 'eco',
    supported_features: 385,
    hvac_modes: ['off', 'heat'],
    specific_states: {
        ext_current_temperature: 6.3,
        is_device_active: false,
        temperature_slope: 1.28,
        hvac_off_reason: null
    },
    vtherm_over_switch: {
        tpi_coef_int: 0.34,
        tpi_coef_ext: 0.014,
        power_percent: 0,
        on_percent: 0
    }
};

let passed = 0;
let failed = 0;
function check(name, fn) {
    try {
        fn();
        console.log(`  ok    ${name}`);
        passed++;
    } catch (error) {
        console.log(`  FAIL  ${name}`);
        console.log(`        ${error.message}`);
        failed++;
    }
}

console.log('Collector: climate attributes');
const kept = extractRelevantAttributes('climate', vtherm);

check('top level temperature is kept', () => assert.strictEqual(kept.temperature, 22.7));
check('hvac_action is kept', () => assert.strictEqual(kept.hvac_action, 'idle'));
check('ema_temp is kept', () => assert.strictEqual(kept.ema_temp, 22.85));
check('power_percent is kept', () => assert.strictEqual(kept.power_percent, 0));
check('specific_states is kept as an object', () => assert.strictEqual(kept.specific_states.ext_current_temperature, 6.3));
check('vtherm_over_switch is kept as an object', () => assert.strictEqual(kept.vtherm_over_switch.tpi_coef_int, 0.34));
check('null nested values are dropped', () => assert.strictEqual('hvac_off_reason' in kept.specific_states, false));
check('arrays are not stored as objects', () => assert.strictEqual(kept.hvac_modes, undefined));

console.log('Analyzer: prompt formatting');
const formatted = formatAttributes(kept);

check('nested values are flattened into the prompt', () =>
    assert.ok(formatted.includes('specific_states.ext_current_temperature=6.3'), formatted));
check('nested tpi coefficients are included', () =>
    assert.ok(formatted.includes('vtherm_over_switch.tpi_coef_int=0.34'), formatted));
check('top level values are included', () =>
    assert.ok(formatted.includes('hvac_action=idle'), formatted));
check('output is prefixed with attrs', () => assert.ok(formatted.startsWith(' | attrs: '), formatted));
check('empty attributes produce nothing', () => assert.strictEqual(formatAttributes(null), ''));
check('arrays are dropped from the prompt', () =>
    assert.ok(!formatAttributes({ hvac_modes: ['off', 'heat'] }).includes('hvac_modes'), 'array leaked'));
check('long attribute strings are capped', () => {
    const long = {};
    for (let i = 0; i < 60; i++) long[`key_${i}`] = i;
    assert.ok(formatAttributes(long).length <= 415, 'not capped');
});

console.log('Sensor domains keep their narrow whitelist');
const sensor = extractRelevantAttributes('sensor', { device_class: 'temperature', extra_field: 1, nested: { a: 1 } });
check('sensor keeps only whitelisted keys', () => assert.deepStrictEqual(sensor, { device_class: 'temperature' }));

console.log(`\nPassed: ${passed}  Failed: ${failed}`);
process.exit(failed === 0 ? 0 : 1);
