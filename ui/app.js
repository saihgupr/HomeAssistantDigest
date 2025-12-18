/**
 * Home Assistant Digest - Frontend Application
 */

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    try {
        const status = await fetchStatus();
        updateStatusDisplay(status);
        updateUIState(status);
    } catch (error) {
        console.error('Failed to initialize app:', error);
        showError('Failed to connect to server');
    }
}

async function fetchStatus() {
    const response = await fetch('/api/status');
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    return response.json();
}

function updateStatusDisplay(status) {
    // API Key status
    const apiStatusEl = document.getElementById('api-status');
    if (status.configured) {
        apiStatusEl.textContent = 'Configured';
        apiStatusEl.classList.add('configured');
        apiStatusEl.classList.remove('not-configured');
    } else {
        apiStatusEl.textContent = 'Not Configured';
        apiStatusEl.classList.add('not-configured');
        apiStatusEl.classList.remove('configured');
    }

    // Digest time
    document.getElementById('digest-time').textContent = status.digestTime;

    // History days
    document.getElementById('history-days').textContent = `${status.historyDays} days`;

    // Entities count
    document.getElementById('entities-count').textContent =
        status.entitiesMonitored === 0
            ? 'Not set up'
            : `${status.entitiesMonitored} entities`;
}

function updateUIState(status) {
    const setupCard = document.getElementById('setup-card');
    const digestCard = document.getElementById('digest-card');
    const startSetupBtn = document.getElementById('start-setup');

    // Determine which setup step we're on
    let setupStep = 'api'; // Need API key
    let buttonText = 'Configure API Key First';
    let buttonDisabled = true;
    let nextPage = '';

    if (status.configured) {
        if (!status.profileComplete) {
            setupStep = 'profile';
            buttonText = '1. Set Up Profile';
            buttonDisabled = false;
            nextPage = '/setup.html';
        } else if (!status.entitiesDiscovered) {
            setupStep = 'entities';
            buttonText = '2. Discover Entities';
            buttonDisabled = false;
            nextPage = '/entities.html';
        } else if (status.entitiesMonitored === 0) {
            setupStep = 'entities';
            buttonText = 'Configure Entities';
            buttonDisabled = false;
            nextPage = '/entities.html';
        } else {
            setupStep = 'complete';
            buttonText = 'Settings';
            buttonDisabled = false;
            nextPage = '/entities.html'; // For now, settings = entities page
        }
    }

    startSetupBtn.textContent = buttonText;
    startSetupBtn.disabled = buttonDisabled;

    // Add click handler for setup button
    if (nextPage) {
        startSetupBtn.onclick = () => {
            window.location.href = nextPage;
        };
    }

    // Show/hide cards based on setup state
    if (setupStep === 'complete') {
        setupCard.classList.add('hidden');
        digestCard.classList.remove('hidden');
    } else {
        setupCard.classList.remove('hidden');
        digestCard.classList.add('hidden');
    }
}



function showError(message) {
    const statusGrid = document.getElementById('status-grid');
    statusGrid.innerHTML = `
        <div class="status-item" style="grid-column: 1 / -1;">
            <span class="value not-configured">${message}</span>
        </div>
    `;
}

// Auto-refresh status every 30 seconds
setInterval(async () => {
    try {
        const status = await fetchStatus();
        updateStatusDisplay(status);
        updateUIState(status);
    } catch (error) {
        console.error('Status refresh failed:', error);
    }
}, 30000);
