---
name: bug-detector
description: Diagnose software defects systematically using acceptance criteria, existing code, and failing tests.
---

# Bug Detector

## Purpose

Diagnose software defects systematically using acceptance criteria, existing code, and failing tests.

## Procedure

1. Read the acceptance criteria, relevant source code, and observed failure.
2. Reproduce the problem with the smallest deterministic input.
3. Identify the likely root cause and relevant lines of code.
4. Separate confirmed defects from hypotheses.
5. Suggest a minimal fix, but do not edit the code yet.
6. Propose a regression test and state the expected result.
7. Present the findings using this format:
   - Defect
   - Evidence
   - Root cause
   - Fix
   - Test

Do not claim that a defect is confirmed unless the code or test output supports the claim. Do not implement fixes unless explicitly asked.
