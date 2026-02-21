---
name: brief
description: "Extract a structured brief from fuzzy user thoughts through conversational Q&A. Use when a user dumps unstructured ideas, vague feature requests, or half-formed plans and needs them turned into a clear, actionable brief. Triggers: user says 'brief me', 'help me clarify this', 'what do I actually want', or pastes a wall of unstructured thoughts asking to make sense of it. Also use when /brief is invoked."
---

# Brief

Turn fuzzy thinking into a structured brief through adaptive Q&A, then a single decision checkpoint.

## Workflow

### Phase 1: Absorb

Read the user's dump. Silently extract what you can into five categories:

- **Requirements** — what must the thing do
- **Constraints** — technical, time, budget, scope limits
- **Non-goals** — what this explicitly is NOT
- **Style** — tone, aesthetic, UX feel, communication style
- **Key concepts** — domain terms, mental models, analogies the user relies on

Do not show this extraction yet.

### Phase 2: Q&A

Ask questions to fill gaps. Rules:

- 2-4 questions per round, max. No walls of questions.
- Prioritize by impact: ask about the biggest ambiguity first.
- Detect when the user is contradicting themselves — surface it gently.
- Adapt: if the user gives terse answers, ask more specific/binary questions. If verbose, ask open-ended ones to let them talk.
- Never ask about something the user already made clear.
- Stop when you can write the brief without guessing.

Question style — direct, not formal:

```
Good: "Should this work offline or is internet always available?"
Bad:  "Could you please elaborate on your connectivity requirements?"
```

### Phase 3: Checkpoint

When clarity is sufficient, present ONE structured checkpoint with all remaining assumptions and forced decisions. Format:

```
## Checkpoint

Confirm or override before I finalize the brief.

1. [Assumption/decision] → **[your default choice]**
2. [Assumption/decision] → **[your default choice]**
3. ...

Reply with corrections or "go" to finalize.
```

Every item must have a default. The user should be able to reply "go" with zero edits if your defaults are reasonable.

### Phase 4: Output

Produce the brief. Format:

```markdown
# Brief: [Title]

> [One-line summary of what this is]

## Requirements
- [ ] [Concrete, testable requirements]

## Constraints
- [Hard limits and boundaries]

## Non-goals
- [Explicitly out of scope]

## Style
- [Tone, aesthetic, feel]

## Key Concepts
- **[Term]**: [Definition in user's language]

## Open Questions
- [Anything deliberately deferred — omit section if none]
```

Rules for the brief:
- Requirements must be testable — "fast" is bad, "loads in <2s" is good.
- Non-goals are as important as goals. Always include at least one.
- Use the user's own language, not jargon upgrades.
- Keep it under 40 lines. A brief is not a spec.

See [references/example.md](references/example.md) for a calibration example.

### Phase 5: Save

After outputting the brief, ask the user where to save it as an MD file. If the user specifies a path, save it there. If the user says "go" or doesn't specify, use sensible defaults:

- Save as `BRIEF.md` in the project's working directory
- If context suggests a specific subdirectory (e.g., the project being discussed), save there instead

Always save the brief after Phase 4 output — do not wait for the user to ask separately.
