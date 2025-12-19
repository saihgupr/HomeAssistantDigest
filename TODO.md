# Home Assistant Digest - TODO

## Completed Features

- [x] Log analysis - analyzes HA Core and Supervisor logs for errors/warnings
- [x] Info button with detailed modal (severity, entities, suggestions, troubleshooting)
- [x] Quick Overview summary section at top
- [x] Fixed Weekly/Daily tab switching and next digest display
- [x] Documented notification timing

---

## Digest Quality Improvements

Priority order based on impact to user experience.

### 1. Reduce Observation Noise (High Priority)

**Problem**: Neutral observations like "Toothpaste Sensor consistently on" and "Unused Speaker Entities" create alert fatigue. They're observations, not insights.

**Solution**:
- [ ] Add "change detection" - only show observations if state differs from previous digest
- [ ] Move stable/unchanged observations to a collapsible "Housekeeping" section
- [ ] Filter out "consistently X state" observations unless they persist 7+ days
- [x] Prompt engineering: instruct Gemini to distinguish between "noteworthy" vs "just data"

**Files**: `server/services/analyzer.js` (prompt), `ui/index.html` (collapsible section)

---

### 2. Smarter Tip of the Day (High Priority)

**Problem**: Current tip is a laundry list of unused entities - not actionable.

**Solution**:
- [x] Limit to ONE specific, actionable tip per digest
- [ ] Rotate tip types: cleanup suggestion, automation idea, performance tip
- [x] Include direct action: "Remove entity X" or "Create automation to Y"
- [x] Prompt engineering: "Pick one high-value action, not a list"

**Files**: `server/services/analyzer.js` (prompt)

---

### 3. Distinguish Data Quality vs Real Issues (Medium Priority)

**Problem**: "Frigate Inference Speed Anomaly" is a data reporting error, not an actual problem. The digest should know the difference.

**Solution**:
- [ ] Add data quality checks before sending to Gemini
- [ ] Flag values that are statistical outliers (>3 std dev) as potential data errors
- [x] Prompt engineering: add "data_quality_issue" as a severity option
- [x] UI: style data quality issues differently (gray vs red/yellow)

**Files**: `server/services/analyzer.js` (data processing + prompt), `ui/index.html` (styling)

---

### 4. Stopped Add-ons Intelligence (Medium Priority)

**Problem**: Listing 5 stopped add-ons as "NEUTRAL" isn't helpful if they're intentionally stopped.

**Solution**:
- [ ] Track add-on state history - only alert if previously running add-on stops
- [ ] Allow user to mark add-ons as "intentionally stopped" (exclude from alerts)
- [ ] Prompt engineering: "Only flag stopped add-ons that have recently changed state"

**Files**: `server/services/homeassistant.js` (add-on tracking), `server/db/` (state history)

---

### 5. Add Missing Insight Types (Medium Priority)

**Problem**: Missing valuable insight categories that HA users care about.

**Solution**:
- [ ] **Failed automations**: Not just dormant, but ones that triggered and errored
- [ ] **Update available**: Flag pending HA Core, add-on, or HACS updates
- [ ] **Security events**: Unusual door/motion sensor activity overnight
- [ ] **Energy trends**: "Used X% more electricity than last week" (if energy data available)

**Files**: `server/services/homeassistant.js` (new data sources), `server/services/analyzer.js` (prompt)

---

### 6. Quick Overview Visual Indicators (Low Priority)

**Problem**: Quick Overview is text-only; could be more scannable.

**Solution**:
- [ ] Add status indicator (green dot, yellow dot, red dot) per line
- [ ] Color-code based on: healthy, warning, critical
- [ ] Keep it subtle - dots/icons only, not colored backgrounds

**Files**: `ui/index.html`, `ui/styles.css`

---

## Questions to Answer

- [ ] What is the CPU impact of entity-based alerts monitoring?
- [ ] Should we add a "mute this type of observation" feature?
