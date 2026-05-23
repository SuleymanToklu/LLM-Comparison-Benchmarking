You are a Lead QA Automation Engineer. I have 4 different implementations of the same project (Developer Profile Analyzer) located in 4 subdirectories: `/abacusai`, `/antigravity`, `/claude`, and `/codex`.

## The Goal

Create a Python-based automated testing and benchmarking tool that evaluates these 4 projects and generates a final comparison report.

## Evaluation Requirements

The script should iterate through each directory and check for:

1. **Build Integrity**: Can the project run `npm install` and `npm run build`?
2. **API Accuracy (CRITICAL)**:
   - Start the local server for each project (e.g., `npm run dev` on different ports).
   - Send a POST request to `/api/analyze` with a real GitHub username.
   - Check if the response matches the Prompt 1 contract (JSON structure).
   - **Detect Mock Data**: Verify if the result is real GitHub data or just the hardcoded "John Doe" mock values.
3. **AI Logic Performance**:
   - Check if the `insights` and `recommendations` fields in the response are populated by Gemini or empty/placeholder.
4. **Error Handling**: Test with a non-existent GitHub username (e.g., `this_user_does_not_exist_12345`) and check if the API returns a proper 404 or error message.
5. **Score Logic**: Verify if `scoreEngine.ts` is actually calculating scores (0-100) or just returning random numbers.

## Output Format

Generate a `benchmark_results.json` and a beautifully formatted `REPORT.md` that includes:
- A comparison table (Model | Build | Real Data | API Accuracy | Scoring | AI Depth | Total Score)
- Noteworthy bugs or deviations found in each implementation.
- A "Winner" recommendation based on code quality and reliability.

## Technical Details

- Use `subprocess` to manage Node.js processes.
- Use `httpx` or `requests` for API testing.
- Ensure ports (3000, 3001, 3002, 3003) do not conflict during tests.
- Assume `.env` files are already configured in each directory.

Provide the complete Python script and instructions on how to run it.
