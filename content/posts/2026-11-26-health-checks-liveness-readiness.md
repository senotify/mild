---
title: "Your Health Check Says 200 OK. Your App Is Not OK"
subtitle: "Why a /health endpoint that always returns 200 hides real outages, and how to split liveness from readiness so your orchestrator can actually help."
tags: [devops, docker, kubernetes, reliability, backend]
date: 2026-11-26T13:52:19+07:00
---

Every service I've ever inherited had a `/health` endpoint. And almost every one of them looked like this:

```js
app.get("/health", (req, res) => res.send("ok"));
```

That endpoint will return `ok` while your database is on fire. It will return `ok` while every request times out. It would probably return `ok` during the heat death of the universe, as long as the Node process is still technically breathing.

It's giving "this is fine" dog, honestly.

## What a health check is actually for

A health check isn't for you. You're asleep. It's for the thing that runs your container, whether that's Docker, Kubernetes, ECS, or a load balancer, so it can make a decision without waking anyone up.

There are really only two decisions on the table:

1. **Should I restart this?** (the process is wedged and won't recover on its own)
2. **Should I send it traffic right now?** (it's alive, but maybe not ready)

Those are different questions. Most setups answer both with the same endpoint, which is where the trouble starts.

## Liveness vs readiness

Kubernetes made these names popular, but the idea applies anywhere.

**Liveness** asks: is the process stuck? A deadlocked event loop, a thread pool that's fully exhausted, a goroutine leak that ate all the memory. Restarting genuinely fixes these.

**Readiness** asks: can this instance serve a request right now? Maybe it's still warming a cache. Maybe the database connection pool dropped and is reconnecting. Restarting won't help here. You just want the load balancer to route around it for a bit.

Here's the part that bit me (well, bit a service I was on call for, same thing at 3am). If you put the database check in *liveness*, then a 30 second database blip makes every instance fail liveness at the same time. The orchestrator helpfully restarts all of them. Now they all boot at once, all open fresh connection pools at once, and stampede the database that was just trying to recover.

Congrats, a small hiccup is now a full outage, and the health check did it.

## A version that tells the truth

Keep liveness dumb and cheap. Make readiness check the things you actually need to serve traffic.

```js
let shuttingDown = false;

// Liveness: is the event loop responsive? Nothing external.
app.get("/livez", (req, res) => res.status(200).send("alive"));

// Readiness: can we serve a real request right now?
app.get("/readyz", async (req, res) => {
  if (shuttingDown) return res.status(503).send("draining");
  try {
    await withTimeout(db.query("SELECT 1"), 1000);
    res.status(200).send("ready");
  } catch {
    res.status(503).send("db unavailable");
  }
});

process.on("SIGTERM", () => {
  shuttingDown = true; // stop taking new traffic, finish in-flight requests
  setTimeout(() => process.exit(0), 10_000);
});

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}
```

A few things worth pointing out.

The timeout matters more than people think. A readiness check that hangs for 30 seconds is worse than one that fails fast, because the prober usually has its own timeout and will just mark you failed anyway, after wasting everyone's time.

The `shuttingDown` flag is the sneaky useful one. When a deploy sends `SIGTERM`, you flip readiness to 503 first, so the load balancer stops sending new requests while in-flight ones finish. Without it you get a little burst of 502s on every single deploy, and you'll spend a week blaming the network. Skill issue (mine, it was mine).

And in Kubernetes the wiring looks roughly like this:

```yaml
livenessProbe:
  httpGet: { path: /livez, port: 3000 }
  periodSeconds: 10
  failureThreshold: 3
readinessProbe:
  httpGet: { path: /readyz, port: 3000 }
  periodSeconds: 5
  failureThreshold: 2
```

Plain Docker only has one `HEALTHCHECK`, and it only marks the container unhealthy. It doesn't restart anything by itself unless something else (Swarm, an orchestrator, a script) acts on it. Ngl, I didn't know that for an embarrassingly long time.

## Don't check your dependencies' dependencies

It's tempting to make readiness check *everything*. Database, Redis, the payment provider, the email API, that one internal service from 2019 nobody owns.

Please don't. If the email provider is down, your instance can still serve 95% of requests. Failing readiness pulls it out of rotation completely, so now you serve 0%. You've turned a partial degradation into a total one, which is lowkey the opposite of the point.

My rule of thumb: readiness checks things that make *every* request fail if they're gone. Usually that's the primary database, and maybe a cache if you truly can't run without it. Everything else gets handled per request, with timeouts and a sensible error.

## Startup is its own problem

One more gotcha. Some apps take a while to boot: JVM warmup, loading a big model, running migrations. If liveness starts checking immediately, the orchestrator kills the container before it ever finishes starting. Then it restarts it. Then kills it again. A very efficient loop of nothing.

Kubernetes has a `startupProbe` for exactly this. Elsewhere, give liveness a generous initial delay. Either way, measure how long your cold start actually takes instead of guessing (I guessed once, I guessed wrong).

## So what do I actually do

If your current health check is `res.send("ok")`, don't rewrite your whole platform tonight. Do two small things:

Split it into `/livez` (cheap, no external calls) and `/readyz` (checks the one or two things you can't live without, with a timeout). Then make readiness return 503 on `SIGTERM` before you exit.

That's maybe twenty lines. It won't make your app reliable by itself, but at least your health check will stop gaslighting you.

I still don't have a great answer for services where "ready" depends on a slow upstream that's *partially* up. If you've solved that cleanly, I'd genuinely love to hear how.
