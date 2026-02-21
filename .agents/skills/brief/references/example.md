# Example Brief

Input (user dump):

> "I want like a dashboard for my team. We use Slack a lot and I feel like nobody knows what anyone's working on. Something simple, maybe a daily standup thing but async. Not another Jira please. Maybe people just post what they're doing and others can see it."

Output:

# Brief: Async Team Visibility Board

> A lightweight async standup tool where team members post daily updates visible to the whole team.

## Requirements
- Team members post a daily status update (what they did, what they're doing, blockers)
- All updates visible in a single feed, filterable by person and date
- Slack integration: reminder to post, and new posts forwarded to a Slack channel
- Works on mobile browser without install

## Constraints
- Team size: 5-15 people
- No user accounts beyond Slack OAuth
- Ship MVP in 2 weeks
- No backend budget — use free tier services only

## Non-goals
- Not a project management tool (no tasks, assignments, deadlines, boards)
- Not a chat app (no replies, threads, or reactions on updates)
- No analytics or reporting on team activity

## Style
- Casual, low-friction — feels like texting, not filling out a form
- Minimal UI, mostly text, no dashboards or charts
- Mobile-first layout

## Key Concepts
- **Update**: A short daily post with three fields — done, doing, blocked
- **Feed**: Reverse-chronological list of all team updates
- **Nudge**: Automated Slack DM reminding someone to post if they haven't by a set time
