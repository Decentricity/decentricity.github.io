# Verification

Verified on the published site, 2026-11-11:

- Desktop welcome screen and first-person garden render without console warnings/errors on initial load.
- Aiming at Poppy displays her name; sending a heart triggers a visible heart and her friendship response.
- Friendship progress survives a page reload and changes the welcome button to Continue.
- Walking across the first cube edge reaches the orchard with the correct camera orientation.
- Pause/resume and settings screens open correctly.
- Welcome layout checked at a 390 × 844 viewport and restored to desktop afterward.
- Static cube tests cover all 24 directed edge crossings, their reversals, and 10,000 repeated corner-travel steps.
- JavaScript syntax checked with Node 22.

The test browser does not provide mouse capture. Drag-to-look and keyboard heart input were exercised; a click-to-send fallback was added for this browser condition. Actual phone multitouch, captured-mouse play, and the full six-friend picnic playthrough have not been manually verified.
