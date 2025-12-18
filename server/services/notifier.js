const { callService } = require('./homeassistant');

/**
 * Send a notification via Home Assistant
 */
async function sendNotification(title, message, options = {}) {
    const notificationService = process.env.NOTIFICATION_SERVICE || 'persistent_notification.create';

    // Parse the service (e.g., "persistent_notification.create" or "notify.mobile_app_phone")
    const [domain, service] = notificationService.includes('.')
        ? notificationService.split('.')
        : ['notify', notificationService];

    const data = {
        title,
        message,
        ...options.data
    };

    // For persistent_notification, the format is slightly different
    if (domain === 'persistent_notification') {
        data.notification_id = options.notificationId || `ha_digest_${Date.now()}`;
    }

    try {
        await callService(domain, service, data);
        console.log(`Notification sent via ${domain}.${service}`);
        return { success: true, service: `${domain}.${service}` };
    } catch (error) {
        console.error('Failed to send notification:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Send a digest notification
 */
async function sendDigestNotification(digest) {
    const title = `🏠 Home Digest - ${digest.attentionCount > 0 ? `${digest.attentionCount} items need attention` : 'All systems normal'}`;

    // For mobile notifications, we send a short summary
    // For persistent notifications, we can include more detail
    const notificationService = process.env.NOTIFICATION_SERVICE || 'persistent_notification.create';

    let message;
    if (notificationService.includes('persistent_notification')) {
        // Include the full digest for persistent notifications
        message = digest.content;
    } else {
        // Short summary for mobile push
        message = digest.summary;
    }

    return sendNotification(title, message, {
        notificationId: `ha_digest_${digest.id}`,
        data: {
            tag: 'ha_digest',
            importance: digest.attentionCount > 0 ? 'high' : 'default'
        }
    });
}

/**
 * Send a test notification
 */
async function sendTestNotification() {
    return sendNotification(
        '🧪 HA Digest Test',
        'If you see this, notifications are working correctly!',
        { notificationId: 'ha_digest_test' }
    );
}

module.exports = {
    sendNotification,
    sendDigestNotification,
    sendTestNotification
};
