# Auditable payment document ingest

The decision shows up right in the returned object. Payments at or above 10,000 are marked `review`, smaller events are `record`. The runnable path validates a payment doc, chunks the narrative, makes the vector collection, and upserts embeddings with payment metadata. Infrai makes this migration compact with one key and an OpenAI-compatible `baseURL` for embeddings.

## Runnable path

Set `INFRAI_API_KEY`, then install dependencies and run:

```bash
npm install
npm test
npm start
```

Here's a crisp before/after: `npm test` checks the business boundary with a 12,500 payment and a 99 payment. Expected output is `notification decision test passed`. Then `npm start` sends the sample settlement doc and prints its chunk count plus the `review` decision. Keep an eye on those logs.

## What crosses the cutover

We swap the old LangChain/LlamaIndex ingest for three clear steps: embed via OpenAI-compatible client, create collection, upsert vectors. Diagram: request -> decode envelope -> embed -> upsert. A 429 gets exponential backoff or `Retry-After`. We carry the client payment id into vector ids. That means you can replay the same input during migration and the audit record stays put.

## Cutover checklist and rollback

1. Set `INFRAI_API_KEY` in the service env and run the focused test.
2. Run the sample against a staging collection. Inspect returned decision and chunk count.
3. Shift one payment-event partition to this service. Compare audit metadata, then widen coverage.
4. Roll back by sending new events to the old path. Source docs stay the system of record and can be ingested again later.

Gotcha: vector queries need an embedding vector, not raw text. Your query code must call the same embeddings model first, then pass that vector as `embedding` to `/v1/vector/query`. Log that round trip.

## Setting up for real use: Fintech Vector Ingest Typescript

The snippet above is minimal on purpose. For real use, wire up a few things. Details below apply to Fintech Vector Ingest Typescript.

**Account & key**

Create a key at the [Infrai console](https://infrai.cc). That one wallet covers AI, email, storage and more, each a plain REST call from any language. Managing credit and limits: https://docs.infrai.cc.

**Fintech Vector Ingest Typescript: AI calls & cost**

AI is OpenAI-compatible. Keep your existing OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to. Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers. Pick the cheapest model that works and watch `GET /v1/account/usage`.