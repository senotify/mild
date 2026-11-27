---
title: "Verifying Webhook Signatures in Node.js Without Fooling Yourself"
subtitle: "Raw bodies, constant-time compares and replay windows: the three places webhook signature checks quietly break."
tags: [security, nodejs, webhooks, backend]
---

Every webhook endpoint I've ever seen starts life as a public URL that accepts JSON from the internet and does something with money-adjacent consequences. Which is a fun combination. The signature header is the only thing standing between your billing logic and anyone with curl and a dream.

Most teams do add signature verification. Most teams also get it subtly wrong in at least one of three ways. I've made two of them myself, so no judgment, just a tour.

## Mistake one: you verified the wrong bytes

The provider signs the exact bytes it sent. Not "the JSON", the bytes. So if your framework parses the body first and you then call `JSON.stringify(req.body)` to compute the HMAC, you're verifying a re-serialization. Key order, whitespace, unicode escapes, number formatting: any of it can differ from what was on the wire.

Sometimes it works for months because the provider's serializer and `JSON.stringify` happen to agree. Then one day a payload has a `/` escaped as `\/` or a float like `1.0`, and your handler starts rejecting real events at 2am. Ask me how I know. (Actually don't, it's a boring story and the answer is "skill issue".)

The fix is to capture the raw body before any parser touches it. In Express:

```ts
import express from "express";

const app = express();

app.post(
  "/webhooks/billing",
  express.raw({ type: "application/json", limit: "1mb" }),
  (req, res) => {
    const rawBody: Buffer = req.body; // a Buffer, not parsed JSON
    // verify first, parse later
  }
);
```

Note the route-level `express.raw`. If you have a global `express.json()` registered earlier, it'll eat the stream and your raw middleware gets nothing. Order matters here, and it's the number one reason people say "the signature never matches, the provider's docs must be wrong". They're usually not wrong.

Also set a body size limit. You're about to hash whatever someone sends you before you've authenticated them, so don't let them send 400MB.

## Mistake two: comparing with `===`

Once you have the bytes, computing the HMAC is easy:

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

function verifySignature(
  rawBody: Buffer,
  signatureHex: string,
  secret: string
): boolean {
  const expected = createHmac("sha256", secret).update(rawBody).digest();

  let received: Buffer;
  try {
    received = Buffer.from(signatureHex, "hex");
  } catch {
    return false;
  }

  if (received.length !== expected.length) return false;
  return timingSafeEqual(received, expected);
}
```

Two details in there are doing real work. First, `timingSafeEqual` instead of `===`. A normal string comparison bails out at the first mismatching character, which in theory leaks how many leading characters of a guess were right. Is that attack practical over a noisy network against your Express app? Honestly, probably hard. But the safe version costs one import, so I'd just use it and stop thinking about it.

Second, the length check. `timingSafeEqual` throws if the two buffers have different lengths, and an unhandled throw in a request handler is a free denial-of-service button for whoever sends a short header. Compare lengths first and return false. (Length isn't secret here, the digest size is public knowledge, so that early return leaks nothing useful.)

One more gotcha: `Buffer.from(str, "hex")` doesn't throw on bad input. It silently stops at the first invalid character and gives you a shorter buffer. So the `try/catch` above is mostly decoration, and the length check is what actually catches garbage. I left the catch in because providers sometimes encode as base64 and you'll swap that line, but don't mistake it for validation.

## Mistake three: no replay protection

Say your signature check is flawless. An attacker can't forge anything. But they can record a legitimate `payment.succeeded` request and send it again tomorrow. And again. The signature is still valid, because it's the same bytes and the same secret.

Good providers include a timestamp, and many sign it as part of the payload (something like `timestamp.body`). You should check that the timestamp is recent:

```ts
const TOLERANCE_SECONDS = 300;

function isFresh(timestampHeader: string, now = Date.now()): boolean {
  const ts = Number(timestampHeader);
  if (!Number.isFinite(ts)) return false;
  return Math.abs(now / 1000 - ts) <= TOLERANCE_SECONDS;
}
```

The important part is that the timestamp is inside the signed material. If it's just a loose header next to the signature, an attacker replays the body with a fresh timestamp and you've built a very polite security theater.

Five minutes is a common window. Shorter breaks when server clocks drift (check your NTP, please, I've seen a box that was eleven minutes off and nobody noticed for a year). Longer gives replays more room.

## The timestamp isn't enough, you need idempotency

Inside the tolerance window an attacker can still replay. And legitimate providers retry on their own, so you'll see the same event twice anyway, signed correctly both times. So the real defense is the same boring thing you already needed: dedupe on the event ID.

```ts
// Postgres: unique constraint on provider event id
// INSERT ... ON CONFLICT (event_id) DO NOTHING RETURNING id
const inserted = await db.query(
  `INSERT INTO webhook_events (event_id, received_at)
   VALUES ($1, now())
   ON CONFLICT (event_id) DO NOTHING
   RETURNING event_id`,
  [event.id]
);

if (inserted.rowCount === 0) {
  return res.status(200).end(); // already seen, ack and move on
}
```

Return 200 for duplicates. If you return an error, the provider keeps retrying, and now you've got a retry storm for an event you already handled. Lowkey the most common self-inflicted wound with webhooks.

I'd do the insert and the actual work in the same transaction if you can, or at least enqueue the work and let the queue consumer be idempotent too. If you insert the event ID, then crash before doing the work, the retry gets swallowed as a duplicate and the event is lost. There's no perfectly clean answer here without a transactional outbox or similar, and I haven't found one that doesn't add moving parts. Pick the failure mode you can live with and monitor for it.

## Secrets and rotation

A few small things that bite later. Keep the signing secret in your secret manager, not in the repo. Support two secrets at once during rotation (try the new one, fall back to the old), otherwise rotating means a window of rejected events. And never log the raw signature header or secret while debugging. "Temporary" log lines have a way of living rent free in production for years.

Also, respond fast. Verify, record, enqueue, return 200. Don't call three downstream services inside the handler, because a slow response makes the provider time out and retry, which brings us right back to the duplicates.

## What I'd actually check in a code review

Does the handler read the raw body? Is the compare constant-time with a length guard? Is there a signed timestamp with a tolerance? Is there a unique constraint on event ID? That's it. Four questions, and they catch most of the webhook bugs I've seen in integrations.
