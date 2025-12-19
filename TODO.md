# Home Assistant Digest - TODO

## Features & Enhancements

### Log Analysis
- [x] Add log analysis to the digest - analyzes HA Core and Supervisor logs for errors/warnings

### Info Button / More Details
- [x] Add an info button that pops up a "more info" window for each issue
  - Shows severity, detailed explanation, affected entities, suggestions, and troubleshooting
  - Modal can be closed by clicking outside, X button, or Escape key

### Better Information Organization
- [x] Reorganize information hierarchy for better UX:
  - Quick overview/assessment at the top with easy-to-read summary info
  - Then critical issues
  - Then less critical issues
- [x] Add "Quick Overview" summary section at the top showing positive status items

### Next Digest Display
- [x] Fix "NEXT DIGEST" display in Weekly tab - now shows day of week (e.g., "Sunday") instead of time
- [x] Fix "NEXT DIGEST" display in Daily tab - shows proper next run time

### Tab Switching Issues
- [x] Fix issue where switching from Weekly to Daily tab requires a page refresh to see the digest
- [x] Ensure digest content updates dynamically when switching between tabs

### Notifications
- [x] Document when notifications get sent out:
  - **Daily digest**: Sent automatically at configured `DIGEST_TIME` (default 07:00)
  - **Weekly digest**: Sent on configured `WEEKLY_DIGEST_DAY` (default Sunday) at same time
  - Uses configured `NOTIFICATION_SERVICE` (default: persistent_notification)

### Alerts Tab (Future Feature)
- [ ] Consider adding an "Alerts" tab that lists entities to add alerts for:
  - Low HDD space
  - Other system health items
  - Could potentially replace manual automation alerts
  - **Research needed**: Evaluate CPU usage for monitoring these entities

## Bugs

- [x] Weekly tab shows "07:00" instead of day of week for next digest - FIXED
- [x] Daily/Weekly tab switching doesn't refresh content without page reload - FIXED

## Questions to Answer

- [x] When do notifications get sent out? - Documented above
- [ ] What is the CPU impact of entity-based alerts monitoring?
