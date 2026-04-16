# Bugfix Requirements Document

## Introduction

This document covers a set of bugs and unfinished implementations found across the Game Zone app. The issues span the Settings page (hardcoded strings bypassing i18n), the guided tour system (missing `data-tour` attributes on Report and Settings pages, a missing "Restart Tour" section in Settings, and inability to navigate backwards across tour pages), and the Consoles page (unsafe deletion of consoles that have active sessions). Together these cause broken localization, a broken tour experience, and potential data corruption.

---

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the user views the Settings page in any language THEN the system displays hardcoded English strings ("Settings", "Configure pricing for your game zone", "Hourly Rates", "Currency", "Save Pricing", "Current Rates", "Not set") instead of translated text, ignoring the active locale.

1.2 WHEN the guided tour reaches the Report page THEN the system renders the tour tooltip with no highlighted element because `[data-tour="report-sections"]`, `[data-tour="date-range"]`, and `[data-tour="export-controls"]` attributes are absent from `Report.jsx`.

1.3 WHEN the guided tour reaches the Settings page THEN the system renders the tour tooltip with no highlighted element because `[data-tour="pricing-form"]`, `[data-tour="currency-field"]`, and `[data-tour="restart-tour"]` attributes are absent from `Settings.jsx`.

1.4 WHEN the guided tour reaches the Settings page THEN the system has no "Restart Tour" UI section, so the `[data-tour="restart-tour"]` step has nothing to point to and the feature described in the tour body does not exist on the page.

1.5 WHEN the user clicks the Back button on the first step of any tour page (other than the very first page) THEN the system does nothing, preventing navigation back to the previous tour page's last step.

1.6 WHEN the user attempts to delete a console that has an active session THEN the system deletes the console record without ending or removing the associated active session, leaving an orphaned session in storage.

---

### Expected Behavior (Correct)

2.1 WHEN the user views the Settings page in any language THEN the system SHALL render all UI strings using `t()` translation calls so that text reflects the active locale (English or Amharic).

2.2 WHEN the guided tour reaches the Report page THEN the system SHALL highlight the correct DOM elements because `data-tour="report-sections"`, `data-tour="date-range"`, and `data-tour="export-controls"` attributes SHALL be present on the corresponding sections in `Report.jsx`.

2.3 WHEN the guided tour reaches the Settings page THEN the system SHALL highlight the correct DOM elements because `data-tour="pricing-form"`, `data-tour="currency-field"`, and `data-tour="restart-tour"` attributes SHALL be present on the corresponding elements in `Settings.jsx`.

2.4 WHEN the guided tour reaches the Settings page THEN the system SHALL display a "Restart Tour" section (with a button that calls `restartTour()`) so the `[data-tour="restart-tour"]` step has a real element to highlight and the feature is functional.

2.5 WHEN the user clicks the Back button on the first step of a tour page that is not the first page THEN the system SHALL navigate to the previous tour page and set the step index to that page's last step, allowing full backwards traversal.

2.6 WHEN the user attempts to delete a console that has an active session THEN the system SHALL display an error toast and SHALL NOT delete the console, preventing orphaned session records.

---

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the user saves pricing on the Settings page THEN the system SHALL CONTINUE TO persist the hourly rates and currency to storage correctly.

3.2 WHEN the guided tour is on any step that is not the first step of its page THEN the system SHALL CONTINUE TO navigate backwards within the same page when Back is clicked.

3.3 WHEN the guided tour completes all pages THEN the system SHALL CONTINUE TO mark the tour as completed in localStorage and hide the tooltip.

3.4 WHEN the user deletes a console that has no active session THEN the system SHALL CONTINUE TO remove the console record successfully.

3.5 WHEN the user starts or ends a session on a console THEN the system SHALL CONTINUE TO update console status and session records correctly.

3.6 WHEN the app is viewed in English THEN the system SHALL CONTINUE TO display all existing translated strings correctly across all pages.
