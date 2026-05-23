# Prompts Used in This Experiment

This directory contains the verbatim prompts issued during the experiment described in the repository's top-level README.

The prompts were issued in the following order:

1. `01-architecture.md` — full project specification
2. `02-backend.md` — backend layer in isolation
3. `03-frontend.md` — frontend layer in isolation, with mock data
4. `04-bridge.md` — integration contract reconnecting frontend to backend
5. `05-benchmark.md` — automated benchmark script specification

Each prompt was issued to each model under test in a fresh conversation, without shared context across models. Within a single model's session, prompts 1 through 4 were issued sequentially in the same conversation; prompt 5 was issued separately to Claude Sonnet to produce the benchmark tooling.

The prompts are preserved here to allow independent reproduction of the experiment.