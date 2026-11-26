---
title: "Treat LLM JSON Output Like Untrusted User Input"
subtitle: "A model that returns JSON is not a typed function. Here is a TypeScript pattern with schema validation, bounded repair and a safe fallback."
tags: [ai, llm, typescript, backend]
---

The first time you ask a language model for JSON and it works, it feels like you have a typed function. Then it returns the object wrapped in a markdown fence, or adds a field you did not ask for, or sends a string where you expected a number. Your parser throws, or worse, it succeeds and the bad data flows downstream.

I think the right mental model is simple: model output is untrusted user input. You would never pass a request body straight into your database layer. The same discipline applies here, and it is not much code.

## Why "just parse it" fails

Even with a well written prompt, a model can fail in a few distinct ways:

- **Syntax errors.** Trailing commas, truncated output because of a token limit, prose before or after the object.
- **Shape errors.** The JSON is valid but a required field is missing or has the wrong type.
- **Semantic errors.** The shape is right but the content is nonsense: a negative quantity, a date in the wrong format, an enum value that does not exist.

`JSON.parse` only catches the first kind. A cast like `as Invoice` catches nothing, because TypeScript types are erased at runtime. If you want safety, you need a runtime check.

## Define the schema once, derive the type

I use Zod for this, but any runtime validator (Valibot, ArkType, a JSON Schema validator) follows the same shape. The key idea is one definition that gives you both the runtime check and the static type.

```ts
import { z } from "zod";

const LineItem = z.object({
  description: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
});

export const Extraction = z.object({
  vendor: z.string().min(1),
  currency: z.enum(["IDR", "USD", "EUR"]),
  items: z.array(LineItem).min(1),
});

export type Extraction = z.infer<typeof Extraction>;
```

Notice the constraints. `positive()`, `min(1)` and the enum are doing real work. They turn semantic errors into validation errors you can detect, instead of bad rows in a table.

## Extract, then validate

Models often wrap JSON in a fence or add a sentence of preamble. Before parsing, I pull out the outermost object. This is deliberately dumb and forgiving:

```ts
function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new Error("No JSON object found in model output");
  }
  return JSON.parse(text.slice(start, end + 1));
}
```

This will not handle every case, and that is fine. If it fails, the failure is explicit and goes into the repair path below. If your provider offers a native structured output or JSON mode, use it as well, since it reduces syntax errors a lot. But I would still validate on my side. A provider feature lowers the failure rate, it does not remove the need to check, and schemas that the provider supports are often a subset of what your validator can express.

## Repair with the error, not a blind retry

When validation fails, the cheapest useful move is to tell the model exactly what was wrong and ask again. A blind retry with the same prompt just samples another answer and hopes. Feeding back the validation error gives the model something concrete to fix.

```ts
type Message = { role: "user" | "assistant"; content: string };
type CallModel = (messages: Message[]) => Promise<string>;

export async function extractWithRepair(
  callModel: CallModel,
  prompt: string,
  maxAttempts = 3,
): Promise<Extraction> {
  const messages: Message[] = [{ role: "user", content: prompt }];
  let lastError = "unknown error";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const raw = await callModel(messages);

    try {
      const parsed = Extraction.safeParse(extractJson(raw));
      if (parsed.success) return parsed.data;

      lastError = parsed.error.issues
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("; ");
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }

    messages.push(
      { role: "assistant", content: raw },
      {
        role: "user",
        content:
          `Your previous reply was invalid: ${lastError}. ` +
          `Reply again with only a corrected JSON object.`,
      },
    );
  }

  throw new ExtractionFailed(lastError, maxAttempts);
}

export class ExtractionFailed extends Error {
  constructor(
    public readonly reason: string,
    public readonly attempts: number,
  ) {
    super(`LLM extraction failed after ${attempts} attempts: ${reason}`);
  }
}
```

A few details here matter more than they look.

**The loop is bounded.** Three attempts is a typical ceiling. Each retry costs money and latency, and if the model fails three times with the error in front of it, a fourth attempt is rarely the answer. The problem is usually the prompt, the schema, or the input.

**The error message is compact.** I send the path and the message for each issue, not the full stack trace. Less noise, fewer tokens, better corrections.

**`callModel` is injected.** The function takes a plain function instead of importing a specific SDK. That keeps provider details out of the logic and makes it trivial to test with a fake that returns scripted bad output.

## Decide what failure means before it happens

The part people skip is the final `throw`. What should the system do when extraction really does fail? That depends on the workflow, and you should decide it on purpose.

In a billing or integration pipeline I have worked on in the past, the usual instinct is that a record we cannot process must not silently disappear and must not be guessed at. So the options I tend to reach for are:

1. **Dead-letter the input.** Store the raw input and the last error, and surface it for a human or a later reprocess.
2. **Fall back to a deterministic path.** If a regex or a template parser handles 70% of inputs, use it before or after the model.
3. **Return a typed failure to the caller.** Let the user fix the input, instead of showing a spinner forever.

What I avoid is filling in defaults to make validation pass. A model that says `quantity: 0` and a schema that quietly coerces it to `1` produces a plausible, wrong invoice.

## Test the unhappy paths

Because `callModel` is injected, the tests are short:

```ts
import { describe, it, expect } from "vitest";

describe("extractWithRepair", () => {
  it("recovers after one invalid reply", async () => {
    const replies = [
      '{"vendor": "Acme", "currency": "GBP", "items": []}',
      '{"vendor": "Acme", "currency": "USD", "items": [' +
        '{"description": "Cable", "quantity": 2, "unitPrice": 5}]}',
    ];
    const callModel = async () => replies.shift()!;

    const result = await extractWithRepair(callModel, "extract this");
    expect(result.currency).toBe("USD");
  });

  it("gives up after the attempt budget", async () => {
    const callModel = async () => "not json at all";
    await expect(
      extractWithRepair(callModel, "extract this", 2),
    ).rejects.toBeInstanceOf(ExtractionFailed);
  });
});
```

I also keep a small set of real inputs that previously broke extraction and replay them whenever I change the prompt or the schema. It is the closest thing to a regression suite you get with a nondeterministic component.

## Log what you need to debug later

For every failure, record the attempt number, the validation error and the raw output (mind privacy if the input contains personal data). When extraction quality drops, this log tells you whether the cause is a prompt change, a model change, or a new kind of input. Without it you are guessing.

## The takeaway

Wrap every model call that is supposed to return structure in three things: a schema that encodes your real constraints, a bounded repair loop that feeds validation errors back, and an explicit decision about what happens when it still fails. That is maybe sixty lines of code, and it turns "the model usually returns good JSON" into a boundary you can reason about.
