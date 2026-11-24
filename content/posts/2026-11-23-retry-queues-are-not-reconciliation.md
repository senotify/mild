---
title: "Your Retry Queue Is Not a Reconciliation Strategy"
subtitle: "Retries fix transient failures. They do nothing for the records that quietly drifted out of sync. Here is how I think about the difference."
tags: [backend, distributed-systems, system-design, integrations]
---

Every backend engineer who has integrated with a third-party system has written the same code. You call an external API, it fails sometimes, so you wrap the call in a retry with exponential backoff. Later you move it onto a queue so a failure doesn't block the user's request. Then you add a dead-letter queue so poison messages stop clogging everything.

At that point it feels done. The dashboard is green, the DLQ is mostly empty, and the sync "works."

It doesn't, not completely. A retry queue answers one question: *did this specific call eventually succeed?* It says nothing about the more important one: *do both systems agree right now?*

Those are different questions, and the gap between them is where money goes missing.

## Three ways data drifts without a single failed job

Here are failure modes I've seen in production billing integrations where the retry queue reported nothing wrong.

**1. The call succeeded, but the response lied.** The partner API returned `200 OK`, and then their own downstream write failed and rolled back. Your side marked the invoice as synced. Their side has no record of it.

**2. The event never fired.** Your sync is triggered by an application event, like `invoice.updated`. Someone fixed a data issue with a direct SQL `UPDATE` at 11pm. No event, no job, no retry. The two systems now disagree, and nothing in your pipeline knows.

**3. Ordering went wrong.** Two updates to the same record were queued close together. A transient failure meant update #1 got retried *after* update #2 succeeded. Both jobs ended in success. The final state on the partner side is the older one.

In all three cases, every job ran and finished green. The retry queue did its job perfectly, and the data was still wrong.

## Retries are about delivery. Reconciliation is about state.

The mental model that helped me most is to separate the two responsibilities.

- **Delivery** (retries, queues, DLQs) gets each change to the other side *eventually*. It's optimistic and event-driven, and it works on individual messages.
- **Reconciliation** periodically compares the actual state of both systems and repairs the differences. It's pessimistic and scheduled, and it works on sets of records.

You need both. Delivery keeps latency low in the normal case. Reconciliation is the safety net that catches everything delivery can't see.

## What a reconciliation job actually looks like

The basic shape is simple:

```ts
async function reconcile(window: { from: Date; to: Date }) {
  const ours = await db.invoices.findMany({
    where: { updatedAt: { gte: window.from, lt: window.to } },
    select: { id: true, amount: true, status: true, version: true },
  });

  const theirs = await partner.listInvoices({ updatedSince: window.from });
  const theirsById = new Map(theirs.map((i) => [i.externalRef, i]));

  for (const inv of ours) {
    const remote = theirsById.get(inv.id);
    if (!remote) {
      await enqueueSync(inv.id, "missing_remote");
    } else if (remote.amount !== inv.amount || remote.status !== inv.status) {
      await enqueueSync(inv.id, "mismatch");
    }
  }
}
```

A few details make the difference between a toy and something you can trust.

**Compare a fingerprint, not every field.** If both sides can compute a hash of the fields that matter (amount, status, line items), you compare one value per record instead of writing field-by-field diff logic that rots as the schema grows.

**Reconcile in windows, with overlap.** Run it every hour over the last three hours, not over the last hour. Clock skew and slow writes mean records land late, and an overlapping window catches them for almost no extra cost.

**Repair through the same path as normal syncs.** Notice that the job above doesn't write to the partner directly. It enqueues a normal sync job. That way repairs get the same retries, logging and idempotency as everything else, and you don't maintain two code paths that do the same write.

**Make the sync idempotent and version-aware.** The ordering problem from earlier goes away if every sync sends the *current* state of the record along with a version number, rather than a delta. The receiver can drop anything older than what it already has. If the partner API doesn't support versions, send full state anyway: "set the invoice to X" is safe to replay, and "add Y to the invoice" is not.

## Record what you found, not just what you fixed

The most valuable output of a reconciliation job isn't the repairs. It's the data about *why* things drifted.

Tag each repair with a reason (`missing_remote`, `amount_mismatch`, `status_mismatch`) and chart the counts over time. A sudden spike in `missing_remote` after a deploy tells you an event stopped firing. A steady trickle of `status_mismatch` might mean a partner-side job is overwriting your updates. Reconciliation turns invisible drift into a metric you can alert on.

It also changes the conversation with the business. "The sync is working" is a feeling. "We found and repaired 14 mismatches out of 120,000 invoices last month, all from one partner outage" is a fact.

## When you can skip it

Not every integration needs this. If the data is low value, easy to regenerate, or the other system is fully owned by your team with a shared database and transactions, a retry queue is fine.

But if the integration moves money, affects what a customer is billed, or feeds a report someone makes decisions from, assume the systems will drift. Build the job that notices.

Retries make your sync *try harder*. Reconciliation makes it *correct*. The second one is the one your finance team cares about.
