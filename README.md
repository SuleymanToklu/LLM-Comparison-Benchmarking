# 🤖 LLM Engineering Benchmark: Developer Profile Analyzer

A rigorous benchmarking experiment that evaluates how 4 state-of-the-art LLMs (AbacusAI, Antigravity, Claude, and Codex) handle strict architectural constraints, API contracts, and edge cases in a full-stack Next.js environment.

## 🎯 Purpose of This Project

This project was NOT built to showcase a simple "AI-generated app." Instead, it is an **Engineering Experiment** designed to test the limits of modern Large Language Models when acting as software engineers. 

As AI tools become ubiquitous, the role of a software engineer is shifting from merely writing syntax to **architecting, prompting, evaluating, and QA testing**. This repository serves as a case study to answer the following questions:
1. Do LLMs follow strict, non-standard architectural constraints (e.g., "Build ONLY the backend", "Use a 24h In-Memory Map instead of native caching")?
2. How resilient is AI-generated code against real-world API constraints (e.g., Rate Limits, 404s, Network timeouts)?
3. Does automated "Black-Box" benchmarking tell the whole truth compared to manual "White-Box" code reviews?

## 🛠️ The Experiment Setup

All 4 models were given the **exact same 3-step prompt sequence**:
1. **Prompt 1 (Architecture):** Define the full-stack app, data normalization rules, deterministic scoring logic, and UI requirements.
2. **Prompt 2 (Backend Constraints):** "Build *only* the backend." Explicitly requested a 24-hour TTL in-memory `Map` cache and complex GitHub repository traversal.
3. **Prompt 3 (Frontend):** Build a responsive Dashboard UI using Recharts and Tailwind CSS with mocked data.

---

## 📊 Results & Deep-Dive Analysis

We evaluated the models using an automated Python Benchmark Script (`run_benchmark.py`) and a manual code review.

### 1. The "Black-Box" Automated Benchmark
The script tested 6 dimensions (Build Integrity, API Contract, Mock Data Detection, Error Handling, Score Sanity, Response Time).

🏆 **Winner: Antigravity (100/100)**  
Antigravity generated the most spec-compliant JSON output, strictly following the requested API contract without missing any nested fields, and delivered fast response times.

🥈 **Runner-ups: Claude & Codex (95/100)**  
Lost minor points for slightly deviating from the API contract (e.g., omitting the `bio` field inside the profile object).

### 2. The "White-Box" Manual Code Review (The Real Truth)
Automated tests don't tell the full story. Manual code inspection revealed critical insights into how these models think:

- 🚨 **The Caching Hallucination (Claude):** Despite explicit instructions to use a `Map` with a 24h TTL, Claude ignored the instruction and relied on Next.js's native `next: { revalidate: 300 }` (5 minutes). While it passed the automated benchmark, in a production environment, this would quickly exhaust GitHub API rate limits.
- 🛡️ **The Defensive Programmer (Codex):** Codex proved to be the most resilient backend engineer. It wrote paranoid, production-ready error handling—reading rate limits from headers, handling concurrency, and explicitly dealing with edge cases during GitHub repository traversal.
- 🤖 **The Full-Stack Bias:** When instructed in Prompt 2 to "Build *only* the backend," **all 4 models failed the constraint**. Because they were using Next.js, the context window biased them into generating UI components (`page.tsx`) anyway.

---

## 🚀 How to Run the Projects

Each folder is a standalone Next.js 14 project. 

1. Navigate to a project folder:
   ```bash
   cd codex # or abacusai, claude, antigravity
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables (CRITICAL):
   ```bash
   cp .env.example .env.local
   ```
   *Note: You MUST add your `GEMINI_API_KEY` to `.env.local`. Adding a `GITHUB_TOKEN` is highly recommended to prevent rate limits.*
4. Start the server:
   ```bash
   npm run dev
   ```

## 🧪 How to Run the Benchmark

Requirements: Python 3.8+, Node.js 18+

```bash
python run_benchmark.py
```
*Results will be generated in the `benchmark/` folder.*

---

## 🛡️ Preemptive FAQ (For the Skeptics)

**Q: "Automated benchmarks are flawed. Did you actually read the code?"**  
Yes. The discrepancy between the automated score (where Claude scored 95) and the manual review (where Claude failed the caching requirement) is a core finding of this experiment. AI code must be audited by humans.

**Q: "Why didn't you use Turborepo or a proper Monorepo setup?"**  
To prevent cross-contamination. Each LLM was given a clean slate to generate its own `package.json`, Next.js config, and folder structure. Wrapping them in a monorepo would require altering their raw output, which ruins the integrity of the experiment.

**Q: "Isn't this just copy-pasting ChatGPT output?"**  
No. This is a framework for **Prompt Engineering QA**. It demonstrates how to establish deterministic API contracts, enforce constraints, and systematically evaluate AI models against those constraints using automated CI/CD-style testing.
