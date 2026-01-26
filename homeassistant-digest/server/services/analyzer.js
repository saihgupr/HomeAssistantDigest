const { getAllSnapshotsForAnalysis } = require('../db/snapshots');
const { getProfile } = require('../db/profile');
const { getMonitoredEntities, getEntityStats } = require('../db/entities');
const { addDigest, getLatestDigest, getLatestDigestByType } = require('../db/digests');
const { getAddonHealthReport, getAutomationHealthReport, getIntegrationHealthReport, getLogHealthReport, getUpdateReport, getFailedAutomations } = require('./homeassistant');
const { getBatteryPredictions } = require('./predictions');
const { getDismissedWarnings } = require('../db/dismissed');
const { getNotesForPrompt } = require('../db/notes');

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

/**
 * Generate a daily digest using Gemini AI
 */
async function generateDigest(type = 'daily') {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        throw new Error('GEMINI_API_KEY not configured');
    }

    // Gather context
    const profile = getProfile();
    const entities = getMonitoredEntities().filter(e => e.priority !== 'ignore');
    const entityStats = getEntityStats();

    // Get snapshot data for the last 24 hours (or 7 days for weekly)
    const now = new Date();
    const hoursBack = type === 'weekly' ? 168 : 24;
    const startTime = new Date(now.getTime() - hoursBack * 60 * 60 * 1000).toISOString();
    const endTime = now.toISOString();

    const snapshots = getAllSnapshotsForAnalysis(startTime, endTime);

    // Fetch add-on health report
    let addonReport = null;
    try {
        addonReport = await getAddonHealthReport();
        console.log(`[Digest] Add-on report: ${addonReport.total} add-ons, ${addonReport.running} running, ${addonReport.issues.length} issues`);
    } catch (error) {
        console.error('[Digest] Failed to get add-on report:', error.message);
    }

    // Fetch automation health report
    let automationReport = null;
    try {
        automationReport = await getAutomationHealthReport();
        console.log(`[Digest] Automation report: ${automationReport.total} automations, ${automationReport.enabled} enabled, ${automationReport.issues.length} issues`);
    } catch (error) {
        console.error('[Digest] Failed to get automation report:', error.message);
    }

    // Fetch integration health report
    let integrationReport = null;
    try {
        integrationReport = await getIntegrationHealthReport();
        console.log(`[Digest] Integration report: ${integrationReport.total} integrations, ${integrationReport.failed} failed`);
    } catch (error) {
        console.error('[Digest] Failed to get integration report:', error.message);
    }

    // Fetch battery predictions
    let batteryPredictions = [];
    try {
        batteryPredictions = await getBatteryPredictions();
        console.log(`[Digest] Battery predictions: ${batteryPredictions.length} batteries tracked`);
    } catch (error) {
        console.error('[Digest] Failed to get battery predictions:', error.message);
    }

    // Fetch log health report
    let logReport = null;
    try {
        logReport = await getLogHealthReport();
        console.log(`[Digest] Log report: ${logReport.errors.length} errors, ${logReport.warnings.length} warnings`);
    } catch (error) {
        console.error('[Digest] Failed to get log report:', error.message);
    }

    // Fetch update report
    let updateReport = null;
    try {
        updateReport = await getUpdateReport();
        console.log(`[Digest] Update report: ${updateReport.updates.length} updates available`);
    } catch (error) {
        console.error('[Digest] Failed to get update report:', error.message);
    }

    // Fetch failed automations
    let failedAutomations = null;
    try {
        failedAutomations = await getFailedAutomations();
        console.log(`[Digest] Failed automations: ${failedAutomations.failures.length} failures`);
    } catch (error) {
        console.error('[Digest] Failed to get failed automations:', error.message);
    }

    // Get dismissed warnings to filter from output
    const dismissedWarnings = getDismissedWarnings();
    console.log(`[Digest] ${dismissedWarnings.length} dismissed warnings to filter`);

    // Get user notes for personalization
    const userNotes = getNotesForPrompt();
    if (userNotes) {
        console.log(`[Digest] Including user notes in prompt for personalization`);
    }

    // Get previous digest for comparison
    let previousDigest = null;
    try {
        const prev = getLatestDigestByType(type);
        if (prev && prev.content) {
            const parsed = JSON.parse(prev.content);
            previousDigest = parsed;
        }
    } catch (e) {
        console.warn('[Digest] Failed to load previous digest for comparison:', e.message);
    }

    // Build the prompt
    const prompt = buildAnalysisPrompt(profile, entities, entityStats, snapshots, type, addonReport, automationReport, integrationReport, batteryPredictions, dismissedWarnings, logReport, updateReport, failedAutomations, userNotes, previousDigest);

    // Call Gemini API
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                parts: [{ text: prompt }]
            }],
            generationConfig: {
                temperature: 0.4, // Lower temperature for more consistent JSON
                maxOutputTokens: 16384, // Increased limit to allow for reasoning + JSON
                topP: 0.9,
                responseMimeType: "application/json" // Force JSON mode
            }
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    const result = await response.json();
    const content = result.candidates?.[0]?.content?.parts?.[0]?.text;

    // Extra logging for debugging large responses as requested in Issue #1
    console.log('[Digest] Raw Gemini Response structure:', {
        candidates: !!result.candidates,
        usage: result.usageMetadata,
        model: result.modelVersion,
        responseId: result.responseId
    });

    if (content) {
        console.log(`[Digest] Content generated (${content.length} chars)`);
        // Log the full content in dev or if explicitly needed, but at least a preview
        if (content.length > 1000) {
            console.log(`[Digest] Content Preview: ${content.substring(0, 500)}... [TRUNCATED] ...${content.substring(content.length - 200)}`);
        } else {
            console.log('[Digest] Content:', content);
        }
    }

    if (!content) {
        throw new Error('No content generated by Gemini');
    }

    // Parse the JSON response - with robust extraction
    let parsedContent;
    let jsonContent = content.trim();

    // Strip markdown code blocks if present (```json ... ``` or ``` ... ```)
    // Be resilient to missing closing triple-backticks
    if (jsonContent.includes('```')) {
        const parts = jsonContent.split('```');
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i].trim();
            if (part.startsWith('{') || part.toLowerCase().startsWith('json')) {
                jsonContent = part;
                if (jsonContent.toLowerCase().startsWith('json')) {
                    jsonContent = jsonContent.substring(4).trim();
                }
                break;
            }
        }
    }

    // Find the first { and attempt to extract everything from there
    const firstBrace = jsonContent.indexOf('{');
    if (firstBrace !== -1) {
        jsonContent = jsonContent.substring(firstBrace);

        // Attempt to find the last } to see if we have a complete-looking object
        const lastBrace = jsonContent.lastIndexOf('}');
        if (lastBrace !== -1) {
            const candidate = jsonContent.substring(0, lastBrace + 1);
            try {
                // If it parses as is, we're good
                JSON.parse(candidate);
                jsonContent = candidate;
            } catch (e) {
                // If it doesn't parse, it might be that the last } wasn't the correct one (nested braces)
                // or the JSON is truncated. We'll keep it as is and let the repair logic handle it.
                // We'll only cut at lastBrace if we're reasonably sure it's the end (low risk of cutting off valid data)
                console.log('[Digest] Candidate JSON within braces failed to parse, keeping full content for repair.');
            }
        }
    }

    try {
        parsedContent = JSON.parse(jsonContent);
    } catch (e) {
        console.error('[Digest] Failed to parse Gemini JSON:', content);
        console.error('[Digest] Extraction attempted:', jsonContent.substring(0, 500));

        // Attempt simple repair if it looks like truncation
        if (e.message.toLowerCase().includes('unexpected end') || e.message.toLowerCase().includes('expected \',\' or \']\'')) {
            console.log('[Digest] Attempting to repair truncated JSON...');
            try {
                const repairedJson = repairTruncatedJson(jsonContent);
                parsedContent = JSON.parse(repairedJson);
                console.log('[Digest] Successfully repaired and parsed JSON');
            } catch (repairError) {
                console.error('[Digest] Repair failed:', repairError.message);
                throw new Error(`Gemini returned malformed/truncated JSON. Original error: ${e.message}`);
            }
        } else {
            throw new Error(`Gemini returned invalid JSON. Error: ${e.message}. Preview: ${content.substring(0, 300)}...`);
        }
    }

    // extract summary and count for DB headers
    const summary = parsedContent.summary || 'Daily Digest generated';
    const attentionCount = parsedContent.attention_items ? parsedContent.attention_items.length : 0;

    // Store the digest (storing the raw JSON string as content)
    const digestId = addDigest(type, JSON.stringify(parsedContent), summary, attentionCount);

    return {
        id: digestId,
        type,
        content: JSON.stringify(parsedContent),
        summary,
        attentionCount,
        generatedAt: now.toISOString()
    };
}

/**
 * Build the analysis prompt for Gemini
 */
function buildAnalysisPrompt(profile, entities, entityStats, snapshots, type, addonReport = null, automationReport = null, integrationReport = null, batteryPredictions = [], dismissedWarnings = [], logReport = null, updateReport = null, failedAutomations = null, userNotes = null, previousDigest = null) {
    const periodLabel = type === 'weekly' ? 'past week' : 'past 24 hours';

    // Detect first-run scenario (no snapshot data yet)
    const isFirstRun = snapshots.length === 0;

    // Group snapshots by entity for analysis
    const entityData = {};
    for (const snap of snapshots) {
        if (!entityData[snap.entity_id]) {
            entityData[snap.entity_id] = {
                friendly_name: snap.friendly_name,
                category: snap.category,
                priority: snap.priority,
                values: []
            };
        }
        entityData[snap.entity_id].values.push({
            timestamp: snap.timestamp,
            value: snap.value_num !== null ? snap.value_num : snap.value_str
        });
    }

    // Build entity summary for the prompt + detect data quality outliers
    const dataQualityIssues = [];

    const entitySummaries = Object.entries(entityData).map(([entityId, data]) => {
        const values = data.values;
        if (values.length === 0) return null;

        // For numeric values, calculate stats and detect outliers
        const numericValues = values.filter(v => typeof v.value === 'number').map(v => v.value);
        let stats = '';
        let outlierFlag = '';

        if (numericValues.length > 0) {
            const min = Math.min(...numericValues);
            const max = Math.max(...numericValues);
            const avg = numericValues.reduce((a, b) => a + b, 0) / numericValues.length;

            // Calculate standard deviation
            const squaredDiffs = numericValues.map(v => Math.pow(v - avg, 2));
            const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / squaredDiffs.length;
            const stdDev = Math.sqrt(avgSquaredDiff);

            // Flag outliers (> 3 standard deviations from mean)
            if (stdDev > 0) {
                const outliers = numericValues.filter(v => Math.abs(v - avg) > 3 * stdDev);
                if (outliers.length > 0) {
                    outlierFlag = ' ⚠️ POSSIBLE DATA QUALITY ISSUE';
                    dataQualityIssues.push({
                        entity: data.friendly_name,
                        entity_id: entityId,
                        issue: `Value(s) ${outliers.map(o => o.toFixed(1)).join(', ')} are >3 std dev from mean (${avg.toFixed(1)} ± ${stdDev.toFixed(1)})`,
                        severity: 'data_quality'
                    });
                }
            }

            stats = `min: ${min.toFixed(1)}, max: ${max.toFixed(1)}, avg: ${avg.toFixed(1)}${outlierFlag}`;
        } else {
            // For state values, show unique states
            const uniqueStates = [...new Set(values.map(v => v.value))];
            stats = `states: ${uniqueStates.join(', ')}`;
        }

        return `- ${data.friendly_name} (${data.category}, ${data.priority}): ${stats}`;
    }).filter(Boolean);

    // Build add-on summary
    let addonSection = '';
    if (addonReport && addonReport.total > 0) {
        // Collect names of stopped add-ons for the prompt
        const stoppedAddons = addonReport.addons
            .filter(a => a.state !== 'started')
            .map(a => a.name);

        // Categorize stopped add-ons by intent
        const unexpectedlyStoped = addonReport.addons.filter(a => a.state !== 'started' && a.boot === 'auto');
        const intentionallyStopped = addonReport.addons.filter(a => a.state !== 'started' && a.boot === 'manual');

        const addonSummary = [
            `Total: ${addonReport.total} add-ons (${addonReport.running} running, ${addonReport.stopped} stopped)`,
            unexpectedlyStoped.length > 0 ? `⚠️ Unexpectedly stopped (boot=auto): ${unexpectedlyStoped.map(a => a.name).join(', ')}` : null,
            intentionallyStopped.length > 0 ? `Intentionally stopped (boot=manual): ${intentionallyStopped.map(a => a.name).join(', ')}` : null,
            addonReport.updateAvailable > 0 ? `Updates available: ${addonReport.updateAvailable}` : null,
            ...addonReport.issues.filter(i => !i.issue.includes('auto-start')).map(i => `- ⚠️ ${i.addon}: ${i.issue}`) // Skip the auto-start issue since we show it above
        ].filter(Boolean);

        addonSection = `
## Add-on Status
${addonSummary.join('\n')}
`;
    }

    // Build automation summary
    let automationSection = '';
    if (automationReport && automationReport.total > 0) {
        const autoSummary = [
            `Total: ${automationReport.total} automations (${automationReport.enabled} enabled, ${automationReport.disabled} disabled)`,
            ...automationReport.issues.slice(0, 5).map(i => `- ${i.name}: ${i.issue}`)
        ].filter(Boolean);

        automationSection = `
## Automation Health
${autoSummary.join('\n')}
`;
    }

    // Build integration summary  
    let integrationSection = '';
    if (integrationReport && integrationReport.issues.length > 0) {
        const intSummary = [
            `${integrationReport.failed} of ${integrationReport.total} integrations have issues:`,
            ...integrationReport.issues.map(i => `- ${i.name} (${i.domain}): ${i.issue}`)
        ];

        integrationSection = `
## Integration Issues
${intSummary.join('\n')}
`;
    }

    // Build battery predictions section
    let batterySection = '';
    if (batteryPredictions.length > 0) {
        const batteryLines = batteryPredictions.map(b => {
            const warning = b.needs_attention ? ' ⚠️ NEEDS ATTENTION' : '';
            return `- ${b.friendly_name}: ${b.current_level}% (draining ~${b.drain_rate_per_day}%/day, ~${b.days_remaining} days remaining)${warning}`;
        });

        batterySection = `
## Battery Predictions
${batteryLines.join('\n')}
`;
    }

    // Build log analysis section
    let logSection = '';
    if (logReport && logReport.analyzed) {
        const logLines = [];
        if (logReport.errors.length > 0) {
            logLines.push(`### Recent Errors (${logReport.errors.length})`);
            logReport.errors.slice(0, 5).forEach(e => {
                logLines.push(`- [${e.source}] ${e.message}`);
            });
        }
        if (logReport.warnings.length > 0) {
            logLines.push(`### Recent Warnings (${logReport.warnings.length})`);
            logReport.warnings.slice(0, 5).forEach(w => {
                logLines.push(`- [${w.source}] ${w.message}`);
            });
        }
        if (logLines.length > 0) {
            logSection = `
## Recent Log Issues
${logLines.join('\n')}
`;
        } else {
            logSection = `
## Logs
Log analysis complete. No critical errors or warnings found in the recent logs.
`;
        }
    }

    // Build update report section
    let updateSection = '';
    if (updateReport && updateReport.hasUpdates) {
        const updateLines = updateReport.updates.map(u => {
            if (u.current && u.available) {
                return `- ${u.name}: ${u.current} -> ${u.available}`;
            }
            return `- ${u.name}`;
        });

        updateSection = `
## Available Updates
${updateLines.join('\n')}
`;
    }

    // Build failed automations section
    let failedAutoSection = '';
    if (failedAutomations && failedAutomations.failures.length > 0) {
        const failureLines = failedAutomations.failures.map(f =>
            `- ${f.name}: Failed ${f.hours_ago}h ago - ${f.error}`
        );

        failedAutoSection = `
## Failed Automations (Last 24h)
The following automations triggered but encountered errors:
${failureLines.join('\n')}
`;
    }

    // Build data quality issues section
    let dataQualitySection = '';
    if (dataQualityIssues.length > 0) {
        const dqLines = dataQualityIssues.map(dq =>
            `- ${dq.entity} (${dq.entity_id}): ${dq.issue}`
        );

        dataQualitySection = `
## Potential Data Quality Issues
These values appear to be statistical outliers and may indicate sensor glitches:
${dqLines.join('\n')}
Use severity "data_quality" for these, not "warning" or "critical".
`;
    }

    // Previous Digest Context
    let previousContext = '';
    if (previousDigest) {
        const prevObs = previousDigest.observations || [];
        const prevItems = previousDigest.attention_items || [];

        if (prevObs.length > 0 || prevItems.length > 0) {
            previousContext = `
## Previous Digest (Yesterday)
Here is what you reported yesterday. implementation:
- **Previous Attention Items**: ${prevItems.map(i => i.title).join(', ')}
- **Previous Observations**:
${prevObs.map(o => `  - "${o.title}": ${o.description}`).join('\n')}

USE THIS TO REDUCE NOISE:
- If an observation is exactly the same as yesterday and hasn't worsened, move it to "housekeeping".
- If an issue persists but isn't critical, consider if it's "stable".
`;
        }
    }

    // First-run specific instructions
    const firstRunInstructions = isFirstRun ? `
## IMPORTANT: First Run Scenario
This is the user's FIRST digest - they just set up the system. There is no snapshot data yet because data collection just started.

DO NOT treat this as an error or critical issue. Instead:
- Be welcoming and congratulate them on setting up
- Explain that data collection has begun and meaningful analysis will be available in the next digest
- Focus on the positive aspects of their setup (entities discovered, profile configured)
- Give a helpful tip about what to expect

The summary should be encouraging, like: "Welcome! Your smart home monitoring is now active. Check back tomorrow for your first full health report."
` : '';

    const prompt = `You are a smart home health analyst for Home Assistant. Analyze the provided data and return a JSON object.
${firstRunInstructions}
## Home Profile
${profile.occupants ? `- Occupants: ${JSON.stringify(profile.occupants)}` : '- Occupants: Not specified'}
${profile.schedule ? `- Schedule: ${JSON.stringify(profile.schedule)}` : '- Schedule: Not specified'}
${profile.priorities ? `- Priorities: ${JSON.stringify(profile.priorities)}` : '- Priorities: Not specified'}
${profile.concerns ? `- Concerns: ${profile.concerns}` : ''}

## Entity Overview
Total monitored: ${entities.length} entities across ${entityStats.length} categories
${addonSection}${automationSection}${integrationSection}${batterySection}${logSection}${updateSection}${failedAutoSection}${dataQualitySection}
${previousContext}
## Data from ${periodLabel}
${entitySummaries.length > 0 ? entitySummaries.join('\\n') : 'No snapshot data available yet - this is expected for a new setup.'}

## Your Task
Analyze the data and return a JSON object with the following structure:

{
  "summary": "A concise one-sentence summary of the home's health.",
  "attention_items": [
    {
      "title": "Short title of issue",
      "description": "Brief explanation of why this is a concern (1-2 sentences).",
      "severity": "critical" | "warning" | "data_quality",
      "detailed_info": {
        "explanation": "Detailed explanation of the issue.",
        "affected_entities": ["entity.id_1", "entity.id_2"],
        "suggestions": ["Specific actionable suggestion 1", "Suggestion 2"],
        "troubleshooting": "Troubleshooting steps if applicable."
      }
    }
  ],
  "observations": [
    {
      "title": "Observation Title",
      "description": "Interesting pattern, trend, or anomaly noticed in the data.",
      "trend": "improving" | "stable" | "degrading" | "neutral",
      "actionable": true | false
    }
  ],
  "housekeeping": [
    {
      "title": "Observation Title",
      "description": "Observation that is stable/unchanged from yesterday or low-priority status quo."
    }
  ],
  "positives": [
    {
      "text": "Specific thing working well or system status",
      "status": "good" | "info" | "warning"
    }
  ],
  "tip": {
    "title": "Short tip headline (max 10 words)",
    "action": "One concise sentence explaining what to do and why"
  }
}

## Guidelines for Analysis

### Attention Items
- Focus on ACTIVE problems, errors, or critical thresholds that need user action
- Use "critical" for immediate risks (data loss, safety, system down)
- Use "warning" for issues that need attention but aren't urgent
- Use "data_quality" for sensor anomalies or reporting glitches (e.g., impossibly high values, stuck sensors)

### Observations vs Housekeeping - REDUCE NOISE
1. **Observations**: Include items that are NEW, CHANGED, or genuinely INTERESTING anomalies. High signal-to-noise ratio.
2. **Housekeeping**: Move everything else here.
    - If an observation appeared in the "Previous Digest" and the state hasn't meaningfully changed, put it in 'housekeeping'.
    - If a sensor "rarely triggers" and that is the status quo, put it in 'housekeeping'.
    - If a state is "stable" and "expected", put it in 'housekeeping'.

### Stopped Add-ons
- Add-ons with boot=auto that are stopped are UNEXPECTED and should be flagged as attention items
- Add-ons with boot=manual that are stopped are INTENTIONAL - do not treat as problems
- Only mention intentionally stopped add-ons in positives if relevant (e.g., "X stopped add-ons are intentionally disabled")

### Tip - ONE CONCISE ACTION
The tip MUST be:
- **Brief**: Title max 10 words, action max 2 sentences
- **Singular**: One tip only, not a list of entities
- **Specific**: Reference ONE exact entity or action, not groups
- **Actionable**: User can do it today

Good examples:
- Title: \"Replace front door battery\", Action: \"At 15%, it will die within a week.\"
- Title: \"Remove stale garage sensor\", Action: \"sensor.old_thermostat hasn't reported in 7 days.\"

Bad examples:
- Listing multiple entities: \"Remove sensor.a, sensor.b, sensor.c...\" (pick ONE)
- Generic advice: \"Consider removing unused entities\" (too vague)
- Long explanations with repeated information

${dismissedWarnings.length > 0 ? `
## DISMISSED WARNINGS - DO NOT INCLUDE THESE:
The user has dismissed the following warnings. DO NOT include any attention_items with these titles or similar topics:
${dismissedWarnings.map(d => `- "${d.title}"`).join('\n')}
` : ''}
${userNotes ? `
## USER PREFERENCES - TAKE THESE INTO ACCOUNT:
The user has added personal notes to help you understand their preferences. Consider these when analyzing:
${userNotes}

For example, if a user notes "I don't update AdGuard Home", do NOT flag AdGuard updates as attention items.
` : ''}
${isFirstRun ? 'Since this is the first run with no data yet, attention_items should be EMPTY and the tone should be welcoming.' : ''}

## IMPORTANT: Keep your internal reasoning/thoughts extremely brief to ensure the JSON response is not truncated. Do NOT include markdown formatting or conversational filler in the JSON output. Return ONLY the raw JSON object starting with { and ending with }.`;

    return prompt;
}

/**
 * Parse the Gemini response to extract structured data
 * Not needed for JSON mode, but kept for compatibility handling if we switch back
 */
function parseDigestResponse(content) {
    return { summary: 'Legacy digest', attentionCount: 0 };
}

/**
 * Get the current digest status
 */
function getDigestStatus() {
    const latest = getLatestDigest();
    const digestTime = process.env.DIGEST_TIME || '07:00';

    // Calculate next digest time
    const now = new Date();
    const [hours, minutes] = digestTime.split(':').map(Number);
    const nextDigest = new Date(now);
    nextDigest.setHours(hours, minutes, 0, 0);

    if (nextDigest <= now) {
        nextDigest.setDate(nextDigest.getDate() + 1);
    }

    return {
        lastDigest: latest ? {
            id: latest.id,
            timestamp: latest.timestamp,
            summary: latest.summary,
            attentionCount: latest.attention_count
        } : null,
        nextDigestTime: nextDigest.toISOString(),
        digestTimeConfig: digestTime,
        apiConfigured: !!process.env.GEMINI_API_KEY
    };
}

/**
 * Enhanced utility to attempt repairing truncated JSON
 */
function repairTruncatedJson(json) {
    let repaired = json.trim();

    // Ensure it starts with {
    if (!repaired.startsWith('{')) {
        const firstBrace = repaired.indexOf('{');
        if (firstBrace !== -1) repaired = repaired.substring(firstBrace);
    }

    // If it's empty after trimming, return empty object
    if (!repaired) return '{}';

    // Count braces and brackets, tracking open structures
    let openQuote = false;
    let escape = false;
    const stack = [];

    for (let i = 0; i < repaired.length; i++) {
        const char = repaired[i];

        if (escape) {
            escape = false;
            continue;
        }

        if (char === '\\') {
            escape = true;
            continue;
        }

        if (char === '"' && !escape) {
            openQuote = !openQuote;
            continue;
        }

        if (!openQuote) {
            if (char === '{' || char === '[') {
                stack.push(char === '{' ? '}' : ']');
            } else if (char === '}' || char === ']') {
                if (stack.length > 0 && stack[stack.length - 1] === char) {
                    stack.pop();
                }
            }
        }
    }

    // 1. If we're inside an open quote, close it
    if (openQuote) {
        repaired += '"';
    }

    // 2. Handle dangling keys (e.g., "key": )
    repaired = repaired.trim();
    while (repaired.endsWith(':')) {
        repaired = repaired.slice(0, -1).trim();
        if (repaired.endsWith('"')) {
            // Find the start of the key string
            let j = repaired.length - 2;
            while (j >= 0 && (repaired[j] !== '"' || repaired[j - 1] === '\\')) {
                j--;
            }
            if (j >= 0) {
                repaired = repaired.substring(0, j).trim();
            }
        }
        repaired = repaired.trim();
    }

    // 3. Remove trailing commas
    repaired = repaired.trim();
    while (repaired.endsWith(',')) {
        repaired = repaired.slice(0, -1).trim();
    }

    // 4. Pop everything from the stack to close remaining structures
    while (stack.length > 0) {
        const needed = stack.pop();
        repaired = repaired.trim();
        if (repaired.endsWith(',')) {
            repaired = repaired.slice(0, -1).trim();
        }
        repaired += needed;
    }

    return repaired;
}

module.exports = {
    generateDigest,
    getDigestStatus,
    repairTruncatedJson
};
