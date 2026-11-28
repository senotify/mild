---
title: "How to Find and Fix Goroutine Leaks in Go"
subtitle: "The classic timeout bug that strands a goroutine forever, how to spot it with pprof and goleak, and the two-line fix."
tags: [go, concurrency, backend, debugging]
---

Goroutines are cheap, so cheap that we spawn them like free samples at a mall. The catch is that a goroutine that never exits is also cheap, right up until you have 400,000 of them and your pod gets OOMKilled at an hour when you were promised sleep.

A goroutine leak is the Go version of a slow memory leak. Nothing crashes. Latency looks fine. The graph for memory just does a gentle upward slope for six days, and then it doesn't.

## The bug that shows up in every codebase

Here's the one I'd bet money is somewhere in your repo right now. A function calls something slow in a goroutine and races it against a timeout:

```go
func fetchWithTimeout(ctx context.Context, url string) (string, error) {
	ch := make(chan string)

	go func() {
		body := slowFetch(url)
		ch <- body // blocks until someone receives
	}()

	select {
	case body := <-ch:
		return body, nil
	case <-time.After(2 * time.Second):
		return "", errors.New("timeout")
	}
}
```

Looks fine. Reads fine. Passes review because everyone is tired.

Now think about what happens when the timeout wins. The function returns, nobody is listening on `ch` anymore, and the goroutine finishes `slowFetch`, reaches `ch <- body`, and waits. Forever. An unbuffered channel send blocks until a receiver shows up, and the receiver left the building. That goroutine, plus everything it references (the response body, the buffers, whatever you captured), is now pinned in memory for the life of the process.

One leaked goroutine is nothing. One per slow request during an upstream incident is how you get paged *because* of the upstream incident and then get paged again, by yourself, an hour later.

## The fix is boring, which is good

Give the channel room for one value:

```go
ch := make(chan string, 1)
```

With a buffer of 1, the goroutine's send succeeds even if nobody's reading, it returns, and the garbage collector cleans up. That's the whole fix for this shape of bug. Honestly it's the most underrated one-character change in Go.

But I'd go a step further, because the goroutine is still doing pointless work after the timeout. `slowFetch` keeps hammering the network for a result nobody wants. Pass the context in and let it cancel:

```go
func fetchWithTimeout(ctx context.Context, url string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()

	type result struct {
		body string
		err  error
	}
	ch := make(chan result, 1)

	go func() {
		body, err := slowFetch(ctx, url)
		ch <- result{body, err}
	}()

	select {
	case r := <-ch:
		return r.body, r.err
	case <-ctx.Done():
		return "", ctx.Err()
	}
}
```

Two things changed. The buffer stays, so the send never blocks. And `slowFetch` now takes the context, so if it's doing an HTTP call with `http.NewRequestWithContext`, the request actually gets abandoned when the deadline hits. Also note I dropped `time.After`, since `context.WithTimeout` already does the timer job and gives you a proper error to return.

(If `slowFetch` is a third-party function that doesn't accept a context, you can't truly cancel it. Buffer the channel, accept that the work finishes on its own, and complain in the issue tracker.)

## Other ways to leak

The timeout race is the famous one, but the same disease has a few variants:

- Ranging over a channel nobody closes. `for v := range ch` waits forever if the producer forgets `close(ch)`.
- A worker loop with no exit path. `for { job := <-jobs; ... }` and no `ctx.Done()` case, so shutdown leaves it sitting there.
- A sender with no receiver, like above, but spread over three files so it's harder to see.
- `time.Ticker` you never stop. Not a goroutine leak exactly, but it lives rent free in the runtime and I've seen it show up in the same heap graphs.

The common thread: every goroutine needs a clear answer to "what makes you stop?" If you can't point at the line, it's probably a leak waiting for traffic.

## How to find them in a running service

First, confirm there's a problem. `runtime.NumGoroutine()` exported as a metric is the cheapest signal. If it only ever goes up and never comes back down after load drops, you've got a leak. Normal services breathe: the count rises and falls.

Then get the actual stacks. If you already import `net/http/pprof` (and put it on an internal-only port, please, not the public one), you can grab them with:

```bash
curl -s "http://localhost:6060/debug/pprof/goroutine?debug=1" | head -50
```

With `debug=1` the output is grouped by identical stack, with a count at the top of each group. A leak looks like one stack with a huge number next to it:

```text
38211 @ 0x43e0f6 0x40b6ff 0x40b2f7 0x6a1c8f 0x470d41
#	0x6a1c8e	main.fetchWithTimeout.func1+0x4e	/app/fetch.go:14
```

Thirty-eight thousand goroutines all parked at line 14. That's your channel send. You don't need to be clever, you just need to read the biggest number.

For a before/after comparison, take two profiles a few minutes apart and diff them with `go tool pprof -base`. The stack that grew is the culprit.

## Catch them in tests instead

Finding leaks in production is a fun hobby for exactly one afternoon. Better to fail the build. Uber's `goleak` package checks that no unexpected goroutines are still alive when a test finishes:

```go
func TestFetchWithTimeout(t *testing.T) {
	defer goleak.VerifyNone(t)

	_, err := fetchWithTimeout(context.Background(), slowServerURL)
	if err == nil {
		t.Fatal("expected timeout")
	}
}
```

Run that against the original buggy version and it fails, pointing at the stuck goroutine. Run it against the fixed one and it passes. You can also put `goleak.VerifyTestMain(m)` in `TestMain` to cover a whole package at once, which I'd probably do for anything that spawns background workers.

One caveat: goleak can be flaky if a goroutine is legitimately still winding down when the check runs. It retries for a short while by default, which handles most cases, but if you have a genuinely slow shutdown you may need to wait for it explicitly before the check. I've been bitten by this once and it was a skill issue on my part, not the library's.

## What I'd actually do

Any time I write `go func()`, I ask where it ends. If the answer involves a channel send, the channel gets a buffer or the send gets a `select` with `ctx.Done()`. If the answer involves "when the service shuts down", there's a context being passed in. And I export the goroutine count as a metric on every service, because it's one gauge and it has saved me more than once.

I still don't have a great answer for goroutines buried inside third-party libraries that leak on their own. For those, the pprof stack at least tells you whose fault it is, which is a small comfort and occasionally a good bug report.
