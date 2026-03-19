# Scenarios

The OSS release branch keeps four public scenarios. Three are local browser labs with deterministic verification, and one is a generic browser task that starts from an operator-supplied URL.

## Kanban

- Scenario id: `kanban-reprioritize-sprint`
- Lab id: `kanban`
- Category: `productivity`

What it exercises:

- reading a structured operator prompt
- rearranging drag-and-drop state in the browser
- verifying exact column membership and card order

How verification works:

- the verifier parses the target board state from the operator prompt
- the live board state is read from the lab
- every card must appear exactly once in the requested column and order

## Paint

- Scenario id: `paint-draw-poster`
- Lab id: `paint`
- Category: `creativity`

What it exercises:

- cursor movement and drawing
- palette selection
- save actions and visual state persistence

How verification works:

- the lab exposes the live canvas grid and the saved draft record
- the verifier compares the saved checksum to the live canvas checksum
- the saved painted-cell count must match the live grid and the result cannot be blank

## Booking

- Scenario id: `booking-complete-reservation`
- Lab id: `booking`
- Category: `commerce`

What it exercises:

- filter selection
- multi-step browsing
- form completion
- booking confirmation

How verification works:

- the operator prompt is parsed into a booking request
- the verifier checks the applied filters in the UI
- the local confirmation record must match the requested hotel, guest, dates, and special request

## Open Web Task

- Scenario id: `open-web-task`
- Lab id: `open_web`
- Category: `general`

What it exercises:

- starting from an operator-supplied URL
- carrying out a one-off browser task against a live website
- reviewing screenshots, event logs, and replay artifacts instead of deterministic lab state

How verification works:

- there is no built-in deterministic verifier for this scenario
- the operator reviews the streamed activity, screenshots, and replay bundle manually
- the runner rejects `verificationEnabled=true` for this scenario to keep the behavior explicit

## Notes On Modes

- `code` mode uses the browser REPL tool (`exec_js`) to drive the same lab.
- `native` mode uses the computer tool directly.
- Verification is the same either way for the local lab scenarios because it reads the final lab state, not the agent transcript.
- `open-web-task` uses the same execution modes but relies on manual review instead of deterministic verification.
