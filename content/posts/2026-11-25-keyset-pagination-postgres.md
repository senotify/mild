---
title: "Stop Using OFFSET: Keyset Pagination in Postgres"
subtitle: "OFFSET pagination gets slower the deeper you go and can skip or repeat rows. Keyset pagination fixes both, if you handle ties and composite sort keys correctly."
tags: [databases, postgres, backend, performance]
---

The first page of a list endpoint is always fast. The problem shows up months later, when someone writes a script that walks through page 4,000 and the database starts doing far more work than anyone expected.

Most of us learned pagination as `LIMIT 20 OFFSET 80`. It is easy to write, easy to explain, and it works fine on small tables. On a table that keeps growing, it has two real problems: it gets slower with depth, and it can return wrong results while data changes underneath it.

## Why OFFSET gets slower

`OFFSET` does not jump to a position. The database still has to produce the rows you are skipping, then throw them away.

```sql
SELECT id, created_at, status
FROM invoices
ORDER BY created_at DESC, id DESC
LIMIT 20 OFFSET 100000;
```

Even with a perfect index on `(created_at, id)`, Postgres walks 100,020 index entries to return 20 rows. Page 1 costs roughly 20 units of work. Page 5,000 costs roughly 100,000. The cost grows linearly with the page number, and there is no index trick that removes it, because the skipped rows still have to be counted.

You can see it yourself with `EXPLAIN (ANALYZE, BUFFERS)`. Compare the same query with `OFFSET 0` and a large offset, and look at the buffer counts and the actual time on the index scan node. The shape of the plan stays the same. The numbers do not.

## The correctness problem nobody mentions

The slowness is the obvious problem. The quieter one is that offsets are positions, and positions move.

Say a client reads page 1 (rows 1 to 20) of a list sorted newest first. Before it asks for page 2, a new row is inserted at the top. Every existing row shifts down by one. Page 2 now starts with the row that was the last item on page 1, so the client sees a duplicate. Delete a row instead of inserting one and the client skips a row it never saw.

For a dashboard, nobody cares. For a sync job, an export, or anything that feeds another system, a skipped row is a bug that is very hard to reproduce. I have seen this class of problem when pulling data out of systems that stay live while you read them, and the cause is almost always positional paging.

## Keyset pagination: remember where you were

Instead of saying "skip N rows", say "give me rows after this one". The client sends back the sort key of the last row it saw, and the query uses it as a filter.

```sql
SELECT id, created_at, status
FROM invoices
WHERE (created_at, id) < ($1, $2)
ORDER BY created_at DESC, id DESC
LIMIT 20;
```

Here `$1` and `$2` are the `created_at` and `id` of the last row on the previous page. With an index on `(created_at, id)`, Postgres seeks straight to that position in the B-tree and reads 20 entries. Page 1 and page 5,000 cost the same.

It is also stable. An insert at the top does not move your cursor, because the cursor is a value, not a position.

## Tiebreakers are not optional

The `id` in that query is doing real work. Suppose you sort by `created_at` alone and 50 rows share the same timestamp (common with batch imports or low-resolution timestamps). If a page boundary falls inside that group, the next query with `created_at < $1` skips the remaining rows in the group entirely.

The fix is to make the sort key unique by appending a column that is unique, usually the primary key. The sort order must be fully deterministic, and the filter must use exactly the same columns in exactly the same order.

Postgres supports row comparison, so `(created_at, id) < ($1, $2)` does the right thing and can use the composite index. Not every database does this well. If yours does not, you can expand it by hand:

```sql
WHERE created_at < $1
   OR (created_at = $1 AND id < $2)
```

This is logically the same, but test the plan. Some planners handle the `OR` form worse than the row-value form.

## Mixed sort directions

Row comparison only works when every column sorts in the same direction. If you need `created_at DESC, id ASC`, the tuple trick breaks, because `(a, b) < (x, y)` compares both columns ascending.

You have two options. Create an index that matches the mixed order and write the expanded `OR` form:

```sql
CREATE INDEX invoices_created_id_idx
  ON invoices (created_at DESC, id ASC);

SELECT id, created_at, status
FROM invoices
WHERE created_at < $1
   OR (created_at = $1 AND id > $2)
ORDER BY created_at DESC, id ASC
LIMIT 20;
```

Or, more simply, change the requirement. Most of the time nobody actually needs the tiebreaker to run in the opposite direction, and `id DESC` is fine.

## Building the cursor

Keep the cursor opaque to clients. Encode the last row's key values and hand back a single string.

```typescript
type Cursor = { createdAt: string; id: number };

export function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c)).toString("base64url");
}

export function decodeCursor(raw: string): Cursor {
  const parsed = JSON.parse(Buffer.from(raw, "base64url").toString());
  if (typeof parsed.createdAt !== "string" || !Number.isInteger(parsed.id)) {
    throw new Error("invalid cursor");
  }
  return parsed;
}
```

Validate on the way in. A cursor is user input, and it goes straight into a query, so it should only ever reach the database as bound parameters, never as concatenated SQL.

To know whether another page exists, fetch `limit + 1` rows. If you get 21, there is a next page: return 20 and build the cursor from the 20th row. This avoids a separate `COUNT(*)`, which is itself expensive on large tables.

## What you give up

Keyset pagination is not free, and the trade-offs are worth knowing before you migrate.

- **No jumping to page N.** You can only go forward (or backward, by flipping the comparison and order). If your UI needs "go to page 47", keyset does not fit.
- **No cheap total count.** If the product needs "showing 1 to 20 of 1,284,331", you will pay for a count separately or show an approximate number.
- **Sort changes need matching indexes.** Every sort order a client can pick needs an index shaped for it. Offering ten sortable columns means thinking hard about which ones you really support.
- **Cursors can go stale.** If the schema or sort definition changes, old cursors break. Version them if cursors live long.

For internal tools with small tables, OFFSET is fine. I would not spend time migrating a table with a few thousand rows.

## When to switch

Use keyset pagination when the data grows without bound, when consumers walk deep into the list, or when correctness matters because another system is reading it, like exports, webhooks or sync jobs. Use OFFSET when the dataset is small and a human really does need to jump to a numbered page.

If you take one thing from this: audit your list endpoints for any that sort by a non-unique column. Add `id` as a tiebreaker today, even before you move off OFFSET. It costs nothing and removes a whole category of intermittent duplicate and missing rows.
