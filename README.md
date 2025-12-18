# Home Assistant Digest

**AI-powered daily health reports for your smart home.**

Home Assistant Digest automatically monitors your smart home, detects anomalies, and delivers daily insights — like having a technician review your system every morning.

---

## Why HA Digest?

Your smart home generates thousands of data points daily, but most go unnoticed until something breaks. HA Digest changes that by:

- **Finding the needle in the haystack** — AI analyzes your entire system to surface what matters
- **Tracking trends over time** — Maintains 7 days of history (even if your HA only keeps 1 day)
- **Catching issues early** — Notices subtle changes before they become problems
- **Learning what's normal for YOU** — Understands your home's unique patterns

---

## What It Catches

| Category | Examples |
|----------|----------|
| **HVAC Issues** | Fan running longer than usual, temperature not reaching setpoint, increased runtime |
| **Device Health** | Low batteries, sensors going offline, degraded signal strength |
| **Energy Anomalies** | Unexpected power spikes, devices drawing more than normal |
| **Pattern Breaks** | Motion sensor in a room that's usually active shows nothing all day |
| **Integration Problems** | Failed automations, unavailable entities, API errors |
| **System Health** | HA performance, add-on status, disk usage |

---

## How It Works

### Phase 1: Home Profile Setup
When you first install, you'll answer a few quick questions:
- How many people live here? Any pets?
- Typical schedule (work from home? 9-5 office?)
- What matters most? (Energy savings? Security? Comfort?)

This context helps the AI understand what's *normal* for your home.

### Phase 2: Smart Assessment
The AI scans your entire Home Assistant and determines:
- Which sensors/devices are worth monitoring
- How to categorize each (climate, security, energy, etc.)
- Priority levels for different entity types
- Relationships between entities (what's in the same room, what controls what)

You can review and customize this monitoring profile.

### Phase 3: Intelligent Data Collection
Home Assistant Digest stores 7 days of history using smart compression:

| Entity Type | Storage Strategy | Example |
|-------------|------------------|---------|
| **Climate sensors** | Hourly averages | Temp: 72°F avg for 2pm hour |
| **Energy monitors** | Hourly totals | Used 1.2 kWh this hour |
| **Binary sensors** | Daily summaries | Motion: 47 triggers, last at 11pm |
| **Slow-changing** | Daily snapshots | Battery: 78% as of midnight |
| **Automations** | Event counts | Ran 3 times, failed 0 |

This keeps storage minimal (~5-10 MB) while preserving everything needed for analysis.

### Phase 4: Daily Analysis
Each day, the AI receives:
- Current state of all monitored entities
- Today's statistics (min/max/avg)
- 7-day trend data
- Any triggered alerts or failures
- Your home context (schedule, preferences)

It then identifies anomalies, trends, and concerns.

```
┌─────────────────────────────────────────────────────────┐
│                     Daily Digest                         │
├─────────────────────────────────────────────────────────┤
│  ATTENTION (1 item)                                      │
│  • HVAC fan runtime up 45% vs. 7-day average            │
│                                                          │
│  TRENDS                                                  │
│  • Living room temp variance decreased (good!)           │
│  • Garage door opened 3x more than usual                 │
│                                                          │
│  ALL GOOD                                                │
│  • All batteries above 30%                               │
│  • No offline devices                                    │
│  • Automations firing normally                           │
└─────────────────────────────────────────────────────────┘
```

---

## Features

- **Free AI Analysis** — Uses Google Gemini API (free tier is plenty)
- **Local History** — Stores 7 days of data independently of HA's recorder
- **Self-Configuring** — AI determines what to monitor (with optional tuning)
- **Flexible Notifications** — Home Assistant notifications, email, or markdown reports
- **Privacy-Focused** — Your data stays local; only anonymized stats go to AI
- **Lightweight** — Minimal resource usage, won't slow down your HA

---

## Installation

### Prerequisites
- Home Assistant OS or Supervised installation
- Google Gemini API key ([get one free here](https://makersuite.google.com/app/apikey))

### Install via Add-on Store

1. Add this repository to your Home Assistant add-on store:
   ```
   https://github.com/YOUR_USERNAME/ha-digest
   ```
2. Install the **HA Digest** add-on
3. Configure your Gemini API key in the add-on settings
4. Start the add-on
5. Run the initial assessment from the add-on UI

---

## Configuration

```yaml
gemini_api_key: "your-api-key-here"
digest_time: "07:00"              # When to generate daily digest
notification_service: "notify.mobile_app_phone"  # HA notification target
history_days: 7                   # Days of history to maintain
snapshot_interval_minutes: 30     # How often to capture entity states
```

---

## Customization

### Ignore List
Tell the AI to stop flagging known issues:

```yaml
ignore_entities:
  - sensor.flaky_garage_motion    # Known to report false positives
  - binary_sensor.guest_room_motion  # Room is unused
```

### Event Notes
Help the AI understand sudden changes by logging events:

```yaml
events:
  - date: "2024-12-01"
    note: "Replaced HVAC filter"
  - date: "2024-12-10"
    note: "Added new smart plug in kitchen"
```

When the AI sees "power usage jumped on Dec 10," it can correlate with your note.

### Priority Overrides
Adjust what the AI considers important:

```yaml
priority_overrides:
  sensor.freezer_temperature: critical   # Alert immediately if abnormal
  light.decorative_lamp: ignore          # Don't care about this one
```

---

## Roadmap

### Coming Soon
- [ ] Initial release with core functionality
- [ ] Web UI for viewing historical trends
- [ ] Custom monitoring rules
- [ ] Multiple digest schedules (morning/evening)

### Future Ideas
- [ ] Integration with Frigate for camera health monitoring
- [ ] Weekly/monthly summary reports with graphs
- [ ] Anomaly detection learning (auto-adjusts baselines)
- [ ] Support for OpenAI/Anthropic APIs
- [ ] Push notifications for critical issues (don't wait for daily digest)
- [ ] Natural language queries ("How did my energy usage compare to last week?")

---

## FAQ

**Q: Does my data leave my network?**  
A: Only entity names and numerical values are sent to Gemini for analysis. No personal data, camera feeds, or sensitive information is transmitted.

**Q: Will this slow down Home Assistant?**  
A: No. Home Assistant Digest runs as a separate add-on and only makes lightweight API calls to your HA instance.

**Q: What if Gemini's free tier isn't enough?**  
A: The free tier allows ~1 million tokens/day. Home Assistant Digest typically uses <10,000 tokens per analysis — you'd need to run it 100+ times daily to hit limits.

**Q: Can I use a different AI provider?**  
A: Currently Gemini-only, but OpenAI/Anthropic support is planned.

**Q: What if I disagree with the AI's assessment?**  
A: You can add entities to the ignore list or adjust priority overrides. The AI learns from your home profile setup, so re-running the assessment with updated answers can help too.

**Q: How much disk space does the history use?**  
A: With smart compression, expect 5-10 MB for 7 days of history. The database auto-purges data older than your configured retention period.

**Q: Can I run the analysis on-demand instead of daily?**  
A: Yes! In addition to the scheduled daily digest, you can trigger an analysis anytime from the add-on UI.

---

## License

MIT License — do whatever you want with it.

---

## Contributing

Issues and PRs welcome! This project is in early development.
