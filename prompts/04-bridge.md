The audit is correct. We need to bridge the gap between Prompt 2 (Backend) and Prompt 3 (UI).

Fix the project using these steps:

1. Reconnect the Frontend to the Real API: In `page.tsx`, replace the mock timer and mock data with a real `fetch` call to `/api/analyze`.
2. Use the real API response to render the dashboard.
3. Clean up the `NormalizedProfile` type to strictly match the contract from Prompt 1.
4. Update UI status messages and Next.js image config to prevent runtime errors.

Final goal: When I enter a username and hit submit, I want real data from GitHub to go through the analyzer and display on the dashboard. No more mock data.
