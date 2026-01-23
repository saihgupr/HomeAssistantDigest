const express = require('express');
const router = express.Router();
const { getProfile, setProfile, isProfileComplete } = require('../db/profile');

/**
 * Profile questions configuration
 */
const PROFILE_QUESTIONS = [
    {
        id: 'occupants',
        title: 'Who lives here?',
        description: 'Help us understand your household',
        type: 'multi-field',
        fields: [
            { id: 'adults', label: 'Adults', type: 'number', min: 1, max: 10, default: 2 },
            { id: 'children', label: 'Children', type: 'number', min: 0, max: 10, default: 0 },
            { id: 'pets', label: 'Pets', type: 'text', placeholder: 'e.g., 2 dogs, 1 cat' }
        ]
    },
    {
        id: 'schedule',
        title: 'What\'s your typical schedule?',
        description: 'This helps us understand normal patterns',
        type: 'select',
        options: [
            { value: 'work_from_home', label: 'Work from home - someone usually here' },
            { value: 'office_9to5', label: 'Office 9-5 - away during weekdays' },
            { value: 'shift_work', label: 'Shift work - irregular schedule' },
            { value: 'retired', label: 'Retired - mostly home' },
            { value: 'mixed', label: 'Mixed - varies by person' }
        ]
    },
    {
        id: 'priorities',
        title: 'What matters most to you?',
        description: 'Select your top priorities (we\'ll weight alerts accordingly)',
        type: 'multi-select',
        options: [
            { value: 'energy', label: '⚡ Energy savings', description: 'Track consumption, find waste' },
            { value: 'security', label: '🔒 Security', description: 'Doors, locks, cameras, motion' },
            { value: 'comfort', label: '🌡️ Comfort', description: 'Temperature, humidity, air quality' },
            { value: 'maintenance', label: '🔧 Maintenance', description: 'Device health, batteries, uptime' },
            { value: 'automation', label: '⚙️ Automation health', description: 'Failed automations, errors' }
        ]
    },
    {
        id: 'concerns',
        title: 'Any specific concerns?',
        description: 'Optional - tell us what you\'re worried about',
        type: 'textarea',
        placeholder: 'e.g., "My HVAC seems to run too long", "Garage door sensor is flaky"',
        optional: true
    }
];

/**
 * GET /api/profile/questions
 * Get the profile questionnaire
 */
router.get('/questions', (req, res) => {
    res.json({
        questions: PROFILE_QUESTIONS,
        totalSteps: PROFILE_QUESTIONS.length
    });
});

/**
 * GET /api/profile
 * Get current profile data
 */
router.get('/', (req, res) => {
    try {
        const profile = getProfile();
        res.json({
            profile,
            isComplete: isProfileComplete()
        });
    } catch (error) {
        console.error('Failed to get profile:', error);
        res.status(500).json({ error: 'Failed to get profile' });
    }
});

/**
 * POST /api/profile
 * Save profile data
 */
router.post('/', (req, res) => {
    try {
        const profileData = req.body;
        console.log('Received profile data:', JSON.stringify(profileData, null, 2));

        if (!profileData || typeof profileData !== 'object') {
            return res.status(400).json({ error: 'Invalid profile data' });
        }

        setProfile(profileData);

        const complete = isProfileComplete();
        console.log('Profile complete status:', complete);
        console.log('Current profile keys:', Object.keys(getProfile()));

        res.json({
            success: true,
            isComplete: complete
        });
    } catch (error) {
        console.error('Failed to save profile:', error);
        res.status(500).json({ error: 'Failed to save profile' });
    }
});

/**
 * GET /api/profile/status
 * Check if profile setup is complete
 */
router.get('/status', (req, res) => {
    try {
        res.json({
            isComplete: isProfileComplete(),
            profile: getProfile()
        });
    } catch (error) {
        console.error('Failed to get profile status:', error);
        res.status(500).json({ error: 'Failed to get profile status' });
    }
});

module.exports = router;
