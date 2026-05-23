# LLM Engineering Benchmark: A Comparative Study of Four Large Language Models on a Constrained Full-Stack Task

## Abstract

This repository documents a controlled experiment in which four large language models — Antigravity, Abacus AI, Claude, and Codex — were given an identical sequence of prompts to build a Developer Profile Analyzer: a Next.js application that ingests a GitHub username, normalizes the user's public activity, computes a deterministic skill score, and generates structured insights through the Gemini 2.0 Flash API. The objective of the study was not to produce a polished application, but to examine how contemporary code-generating models interpret architectural constraints, respect declared data contracts, and behave under deliberately ambiguous or adversarial instructions. The study combines an automated black-box benchmark with a manual white-box code review, and reports several findings in which the two methods disagree.

## 1. Motivation

As code-generation models become a routine part of professional software development, the role of the engineer is increasingly shifting from authoring syntax to specifying constraints, evaluating output, and auditing generated code. Public benchmarks for code models tend to measure isolated capabilities such as function completion, algorithmic correctness, or unit-test pass rates. Comparatively few studies examine how the same models behave when given a multi-layered engineering task containing explicit architectural directives, non-default conventions, and integration boundaries that span an external REST API and a third-party language model.

The Developer Profile Analyzer was selected as the experimental target because it combines six concerns that rarely appear together in a single short prompt: third-party API integration, data normalization, deterministic business logic, large-language-model integration, user-interface composition, and error handling against well-known failure modes such as rate limits and missing resources. The hypothesis underlying the experiment is that the joint presence of these concerns reveals architectural disposition — how a model balances completeness against constraint-adherence — in a way that single-concern benchmarks cannot.

## 2. Methodology

### 2.1 Project Brief Before Code

Prior to issuing any code-generation prompt, a structured project brief was authored describing the application's scope, data flow, and success criteria. This brief was discussed with several models for architectural feedback before any implementation prompt was written. The purpose of this preparatory step was twofold: to surface ambiguities in the specification before they could propagate into generated code, and to observe which models proactively challenged scope decisions versus which immediately produced implementations. The brief was deliberately not shared with the four models under test; only the derived prompts were.

### 2.2 Layered Prompting

Rather than issue a single monolithic prompt, the specification was decomposed into three sequential prompts corresponding to distinct architectural layers. The first prompt established the full project, including framework choice, folder structure, data contracts, and acceptance criteria. The second prompt restricted scope to the backend layer, requesting only the API route, the GitHub fetcher, the analyzers, the scoring engine, and the AI integration. The third prompt requested the frontend layer in isolation, supplied with mock data rather than a live backend.

This decomposition was motivated by two concerns. The first was attentional: a single very long prompt risks attentional dilution, in which models satisfy the easier portions of the request while glossing over the harder ones. The second was diagnostic: by separating layers, the experiment could distinguish whether a deficiency in the output reflected a misunderstanding of the layer's responsibilities or a failure to maintain context across the full specification.

A known risk of layered prompting is context collision, in which a later prompt's instructions override or contradict assumptions baked into earlier output. This risk materialized in the experiment and is discussed in Section 5.

### 2.3 The Normalization Layer as a Diagnostic

The first prompt declared a strict NormalizedProfile interface and stated, in capitalized emphasis, that raw GitHub API responses were never to be forwarded to the language model — only the normalized projection. This requirement functioned as a diagnostic for architectural judgment. A model that preserves the raw GitHub field names and forwards the API response to the language model reveals that it treats the language model as a general-purpose interpreter rather than as a component sitting behind a defined contract. Conversely, a model that introduces an explicit normalization step demonstrates an understanding that downstream components, particularly probabilistic ones, are easier to reason about when they receive a stable, minimal input schema.

This diagnostic was placed deliberately because it does not affect surface-level correctness: an application that skips normalization will frequently still appear to work for the canonical test case, which is precisely what makes it a useful probe of architectural maturity.

### 2.4 Deterministic Scoring Before Inference

The specification required that all skill scores be computed by deterministic rules before any call to the language model. The language model was permitted to interpret and contextualize the scores, but not to produce them. This separation was a second diagnostic. Models that delegate scoring to the language model produce results that are non-reproducible, expensive to compute, and difficult to audit. Models that respect the separation produce explainable scores that can be regression-tested independently of the inference layer.

The separation also reflects a broader engineering principle: language models are most reliable when used as a translation or summarization layer over inputs that have already been validated and structured. This principle was encoded into the prompt rather than left implicit, in order to observe which models would honor it without further reinforcement.

### 2.5 Definition of Done

Each prompt concluded with an explicit acceptance-criteria section, modeled on the Definition of Done convention from agile practice. The intention was to discourage models from terminating at the happy path. Without such criteria, code-generation models tend to produce implementations that succeed on the canonical input and fail silently on adversarial ones. With criteria present, models are observed to add input validation, error branches, and fork filtering more reliably, though, as Section 5 reports, not uniformly.

### 2.6 Choice of Inference Provider

Gemini 2.0 Flash was selected as the inference provider for cost and accessibility reasons rather than capability reasons. The experiment is not a comparison of inference providers; the same provider is used identically across all four implementations, so any variation in output quality is attributable to the four models under test rather than to the inference layer they share.

### 2.7 Integration Bridge

After the three layered prompts were executed, an integration gap became apparent. The frontend prompt had been written against mock data, while the backend prompt had produced a real API. Connecting the two required a fourth prompt that defined the wire contract between them. This was an unanticipated cost of layered prompting and is reported here as a methodological finding: when a specification is split into layers, the integration contract between those layers must be specified explicitly in advance rather than reconstructed afterward.

### 2.8 Automated Benchmark Script

A separate prompt was issued to Claude Sonnet to produce an automated benchmark script. This script was constrained by several non-functional requirements: it was read-only with respect to the four implementations, wrote all output to an isolated /benchmark directory, assigned a distinct port to each implementation in order to avoid interference, and was required to run on Windows, macOS, and Linux without modification. The script measured six dimensions: build integrity, conformance to the declared API contract, presence of real versus mocked data, error handling against unknown usernames, sanity of the scoring output, and response time.

## 3. Results

### 3.1 Automated Benchmark

The automated benchmark produced the following scores:

| Model       | Build | API Contract | Real Data | Error Handling | Score Logic | Response Time | Total   |
|-------------|-------|--------------|-----------|----------------|-------------|---------------|---------|
| Antigravity | Pass  | Pass         | Pass      | Pass           | Pass        | 1,840 ms      | 100/100 |
| Claude      | Pass  | Fail         | Pass      | Pass           | Pass        | 1,823 ms      | 95/100  |
| Codex       | Pass  | Fail         | Pass      | Pass           | Pass        | 4,443 ms      | 95/100  |
| Abacus AI   | Pass  | Fail         | Pass      | Pass           | Pass        | 2,202 ms      | 90/100  |

All four implementations built successfully, all four returned live GitHub data rather than mock values, and all four returned appropriate error responses for unknown usernames. Three of the four implementations deviated from the declared API contract in minor ways, most commonly by omitting nested fields such as the user biography within the profile object.

### 3.2 Per-Model Observations

**Antigravity** produced the most contract-conformant output by the metrics the benchmark script measured, and posted the fastest response time. However, manual inspection revealed that its implementation preserved several raw GitHub field names — such as `avatar_url` and `public_repos` — within the response payload rather than projecting them into the declared NormalizedProfile shape. The implementation satisfies the contract as the script tests it, while violating the normalization principle the specification was meant to enforce. This discrepancy is discussed in Section 4.

**Claude** produced an implementation whose backend score logic was internally consistent and whose error handling was the most defensive of the four. However, manual review found that Claude ignored the explicit instruction to implement a 24-hour in-memory Map cache, and instead relied on the Next.js native fetch cache with a five-minute revalidation window. The implementation passes all automated tests, but in a production deployment the shorter cache window would significantly accelerate exhaustion of the GitHub API rate limit.

**Codex** produced the most defensively written backend of the four, with explicit handling of GitHub rate-limit headers, concurrency, and edge cases in repository traversal. However, the scoring engine in the benchmarked configuration returned zero values for backend, frontend, and devops dimensions. It is not clear from the automated results alone whether the scoring engine itself is defective or whether the test username produced no qualifying signals; this requires further manual review and is reported as an open observation rather than a confirmed defect.

**Abacus AI** produced an implementation whose backend score values were numerically identical to Claude's for several dimensions. This convergence is consistent with both implementations honoring the deterministic scoring rules declared in the prompt, rather than evidence of shared provenance: when two models correctly implement the same deterministic formula, they should return the same numbers. The convergence is therefore reported as a positive consistency check on the scoring specification rather than as an anomaly.

### 3.3 Cross-Cutting Observation: The Backend-Only Constraint

The second prompt instructed all four models to build only the backend. All four models nonetheless produced frontend components alongside the requested backend modules. This is discussed in Section 5 as a methodological limitation rather than a model defect.

## 4. Discussion

### 4.1 Black-Box and White-Box Methods Disagree

The most consequential finding of the experiment is that the automated benchmark and the manual code review produced inconsistent rankings. Antigravity is ranked first by the automated benchmark but, on manual review, was found to have skipped the normalization layer that the specification treated as architecturally central. Claude is ranked second by the automated benchmark but, on manual review, was found to have ignored an explicit caching directive in a way that would materially affect production behavior. The benchmark script in its present form measures the shape of the response, not the structure of the code that produced it; consequently, architectural shortcuts that do not alter the response shape are invisible to it.

The implication for practitioners is direct: automated evaluation of code-generation models is necessary but not sufficient. Properties such as adherence to declared caching strategies, fidelity to declared data contracts, and the presence of an explicit normalization layer cannot be inferred from response payloads alone. Code review by a human auditor remains a necessary step.

### 4.2 Constraint Adherence Under Framework Pressure

The failure of all four models to honor the backend-only constraint warrants closer examination. As discussed in Section 5, the prompt itself contained a structural ambiguity that may account for this uniformity. The observation that all four models defaulted to the framework's dominant convention rather than to the user's explicit instruction is, in either interpretation, worth recording: code-generation models appear to be strongly biased toward the conventional usage of the framework they are working within, and explicit instructions that contradict those conventions are not reliably respected without additional reinforcement.

### 4.3 Convergent Numerical Output as a Validation Signal

The numerical convergence between Claude's and Abacus AI's scoring output, initially noted as a surprising similarity, is on reflection an expected consequence of deterministic specification. When the scoring rules are fully specified in the prompt and two models correctly implement those rules, identical scores are the correct outcome. This re-interpretation does not weaken the finding; it strengthens the case that deterministic specification of business logic produces reproducible behavior across heterogeneous model implementations.

## 5. Limitations

Several limitations of the present experiment should be acknowledged.

**Structural ambiguity in the backend-only prompt.** The second prompt instructed the models to build only the backend, but located the requested files within the Next.js App Router file system, which by convention houses page components. The prompt therefore contained an implicit contradiction between its stated constraint and its declared file layout. The uniform failure of all four models to honor the constraint may reflect this contradiction rather than a model deficiency. A more rigorous version of the experiment would issue the backend-only prompt against a framework whose conventions do not collocate UI and API code, such as a standalone Express or Fastify project.

**Underspecification of the consistency metric.** The first prompt required a consistency score derived from commit frequency over the preceding ninety days, but did not specify a functional form for the derivation. Differences between models on this dimension may reflect prompt underspecification rather than differing engineering judgment.

**Unverified scoring output for one model.** The benchmark recorded zero values across several scoring dimensions for Codex's implementation. Whether this reflects a defect in the implementation or a property of the specific test input has not been verified by manual reproduction.

**Single test username.** The benchmark was executed against a single canonical username and a single error-path username. Broader sampling across user accounts with different profile shapes — for instance, accounts dominated by forked repositories, accounts with no public repositories, and accounts with very large repository counts — would produce a more robust evaluation.

**Single inference provider.** All four implementations share Gemini 2.0 Flash as the inference layer. The experiment does not isolate the contribution of the inference provider from the contribution of the code-generation model and does not generalize to setups using a different inference layer.

**Bridge prompt as confound.** The integration bridge described in Section 2.7 was authored after the three primary prompts and may have implicitly favored some models over others depending on how closely each model's backend and frontend already aligned. Future iterations should specify the wire contract in advance of layered prompting rather than after it.

## 6. Lessons for Prompt Engineering

The experiment yields several lessons that generalize beyond the specific application built.

Complex specifications benefit from decomposition into layered prompts corresponding to architectural boundaries, provided the integration contract between layers is specified in advance rather than reconstructed afterward.

Data contracts should be declared explicitly within the prompt rather than left to model inference. The presence of a declared interface enables both the model and the evaluator to reason about conformance.

Acceptance criteria should be enumerated at the close of each prompt. Without them, code-generation models terminate at the canonical success path; with them, error branches and edge handling appear more reliably.

Deliberate diagnostics — instructions that do not affect surface correctness but reveal architectural disposition — are a useful tool for evaluating models on tasks larger than a single function. The normalization-layer requirement and the rule-engine-before-inference requirement in this study both functioned as such diagnostics.

Layered prompts must allow the integration contract to be specified in advance. The need to author a fourth prompt to bridge backend and frontend in this study should be read as a methodological warning rather than a successful technique.

Automated benchmarks should be authored under the same discipline applied to the code under test, including read-only constraints on the test target, output isolation, and cross-platform portability.

Automated evaluation does not subsume manual review. Properties that do not alter the response payload — caching strategy, presence of normalization, fidelity to declared file structure — are not visible to response-shape benchmarks and must be audited by hand.

Cost-accessible inference providers such as Gemini Flash lower the barrier to reproducibility for experiments of this kind, and should be preferred for studies whose findings are intended to be re-runnable by independent parties.

## 7. Reproducibility

The experiment may be reproduced as follows. A specification document is authored describing a target application that spans multiple architectural concerns. The specification is decomposed into layered prompts corresponding to architectural boundaries, with explicit data contracts and acceptance criteria attached to each layer. An integration prompt is authored alongside the layered prompts rather than after them. The prompts are issued in identical form to each model under test, in a fresh session without shared context. The resulting implementations are exercised by an automated benchmark that measures response-shape properties, and are independently reviewed by a human auditor for properties not visible to the benchmark. Discrepancies between the two evaluation methods are recorded and reported.

The four implementations are located in this repository under directories named for the originating model. The benchmark script is located at the repository root and writes its output to the benchmark directory. Each implementation expects a GEMINI_API_KEY environment variable; a GITHUB_TOKEN environment variable is optional but recommended in order to avoid GitHub API rate limits during benchmarking.

To execute a single implementation, navigate to its directory, install dependencies with the standard Node package manager, copy the example environment file, populate it with the required credentials, and start the development server. To execute the full benchmark, ensure Python 3.8 or later and Node.js 18 or later are available, and run the benchmark script from the repository root.

## 8. Conclusion

This study reports a small, controlled comparison of four code-generation models on a multi-layered engineering task. The findings are modest in scope but consistent in direction. Code-generation models in their present generation are capable of producing functional implementations of non-trivial specifications, but adherence to architectural constraints that do not affect surface correctness remains uneven. Automated benchmarks based on response shape are insufficient to detect such deviations. The discipline that distinguishes a useful application of these models from an unreliable one lies less in the length or sophistication of the prompt than in its architecture: the explicit declaration of data contracts, the separation of deterministic logic from inferential logic, the enumeration of acceptance criteria, and the inclusion of diagnostics that probe architectural disposition rather than surface behavior.

The broader implication is that the practice of working with code-generation models is converging with the practice of specifying and reviewing the work of human engineers, and benefits from the same instruments: clear contracts, explicit acceptance criteria, and audit by a second party. The four implementations compared in this repository are not equivalent, but the differences between them are most clearly revealed when both methods of evaluation — automated measurement and manual review — are applied together.
