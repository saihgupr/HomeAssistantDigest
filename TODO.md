# Home Assistant Digest - TODO

## Features & Enhancements

### Log Analysis
- [ ] Add log analysis to the digest - currently it does not look at HA logs

### Info Button / More Details
- [ ] Add an info button that pops up a "more info" window for each issue
  - Example: For "Disabled Automations", the info window should provide more context to help users make fixes
  - Should include troubleshooting tips, related entities, and potential solutions

### Better Information Organization
- [ ] Reorganize information hierarchy for better UX:
  - Quick overview/assessment at the top with easy-to-read summary info
  - Then critical issues
  - Then less critical issues
- [ ] Add "All Good" summary section at the top showing positive status items:
  - Majority of add-ons running smoothly (X out of Y)
  - Most automations enabled and active (X out of Y)
  - Network connectivity stable
  - Backup processes successful and up-to-date
  - Device batteries at healthy levels
  - AdGuard Home Protection enabled
  - Zigbee2MQTT bridge connection stable

### Next Digest Display
- [ ] Fix "NEXT DIGEST" display in Weekly tab - should show day of week (e.g., "Monday") instead of time "07:00"
- [ ] Fix "NEXT DIGEST" display in Daily tab - should show proper next run time

### Tab Switching Issues
- [ ] Fix issue where switching from Weekly to Daily tab requires a page refresh to see the digest
- [ ] Ensure digest content updates dynamically when switching between tabs

### Notifications
- [ ] Document/implement when notifications get sent out
- [ ] Add notification scheduling configuration

### Alerts Tab (Future Feature)
- [ ] Consider adding an "Alerts" tab that lists entities to add alerts for:
  - Low HDD space
  - Other system health items
  - Could potentially replace manual automation alerts
  - **Research needed**: Evaluate CPU usage for monitoring these entities

## Bugs

- [ ] Weekly tab shows "07:00" instead of day of week for next digest
- [ ] Daily/Weekly tab switching doesn't refresh content without page reload

## Questions to Answer

- [ ] When do notifications get sent out?
- [ ] What is the CPU impact of entity-based alerts monitoring?
