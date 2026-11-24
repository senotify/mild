# Daily post guide (for the writing routine)

Author: Arya Annurseno (@senotify), a backend engineer in Jakarta with 6+ years
in the Telkom Indonesia group: B2B billing platforms, third-party integrations,
event-driven pipelines (Kafka, Bull, Redis), Node.js, Go, TypeScript, Laravel,
Docker, self-hosted infra. Writes for working engineers.

## One post per day

1. Read the frontmatter (title, tags) of the 20 most recent files in
   `content/posts/` so you don't repeat a topic or angle.
2. Rotate through these areas, picking whichever is least recent:
   backend/APIs, AI and LLM engineering, databases, distributed systems,
   DevOps/infrastructure, system design, security, programming languages
   (Go, TypeScript, Node.js), career/craft of engineering.
3. Pick a specific, practical angle: a pattern, a trade-off, a failure mode, a
   how-to. Not news, not "Top 10" lists, not hype.
4. Write the file `content/posts/YYYY-MM-DD-short-slug.md` (today's date,
   Asia/Jakarta). If a file for today already exists, stop: do nothing.

## Style

- 900-1,500 words. A hook in the first two sentences. `##` subheadings.
- First person where it fits ("I've seen this in billing systems..."), but never
  invent specific employers, incidents, numbers or metrics about the author.
- Concrete code examples (fenced, with a language) where they help.
- Plain, human tone. Short paragraphs. No marketing voice.
- **Never use em dashes (—) or en dashes (–).** Use commas, colons, parentheses
  or separate sentences.
- Avoid filler phrases: "In today's fast-paced world", "Let's dive in",
  "game-changer", "delve", "In conclusion".
- End with a short, concrete takeaway, not a summary of every section.
- Facts must be accurate. If unsure about a version number or API detail, leave
  it out.

## Frontmatter

```yaml
---
title: "Specific, curiosity-worthy title (under 70 chars)"
subtitle: "One sentence on what the reader will get (under 160 chars)"
tags: [3-5 lowercase tags, hyphenated, e.g. backend, system-design, go]
---
```
