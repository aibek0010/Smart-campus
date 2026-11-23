# Smart Campus Room Availability Checker

## Project Overview

Smart Campus Room Availability Checker is a web application that helps users check room availability based on selected time intervals, room schedules, and existing bookings.

The project was developed using React, TypeScript, and Vite as part of Software Engineering coursework.

## Technologies

- React
- TypeScript
- Vite
- Vitest
- ESLint
- Node.js and npm

## Installation

Clone the repository:

```bash
git clone https://github.com/aibek0010/Smart-campus.git
cd Smart-campus
```

Install dependencies:

```bash
npm ci
```

## Running the Application

Start the development server:

```bash
npm run dev
```

Open the local address displayed in the terminal.

## Testing and Verification

Run automated tests:

```bash
npm run test
```

Check TypeScript:

```bash
npm run typecheck
```

Run ESLint:

```bash
npm run lint
```

Build the project:

```bash
npm run build
```

## Verification Results

After the Task 07 mitigations:

- Automated tests: 95 passed out of 95
- TypeScript typecheck: passed
- ESLint: passed
- Production build: passed

The build may display a non-blocking warning about outdated caniuse-lite browser data.

## Software Engineering Assignment #05

The project was reviewed and improved through ten tasks covering:

1. Baseline and project context
2. AGENTS.md instructions
3. Design pattern decision
4. AI-assisted risk review
5. Risk register
6. Agent-readiness audit
7. Risk mitigation and verification
8. Background agent safeguards
9. Release decision
10. AI reflection

## Risk Mitigations

**R01 — Invalid Numeric Inputs**

The availability checker now rejects non-finite numeric values such as NaN and Infinity.

**R02 — Malformed Booking Data**

Invalid booking records are rejected safely instead of being silently ignored.

## AI Agent Instructions

See `AGENTS.md` for repository architecture, safe commands, testing requirements, prohibited actions, and human review procedures.

## Release Status

**CONDITIONAL GO**

All 95 automated tests pass. Remaining dependency maintenance risks and human review requirements are documented in the assignment report.
