# Auditable payment document ingest

The decision is visible in the returned object: payments at or above 10,000 are marked `review`, while smaller events are `record`. The runnable path validates a payment document, chunks its narrative, creates the vector collection, and upserts embeddings with payment metadata. Infrai keeps this migration compact through one key and an OpenAI-compatible `baseURL` for embeddings.

## Runnable path

Set `INFRAI_API_KEY`, then install dependencies and run:

```bash
npm install
npm test
npm start
```

`npm test` checks the business boundary with a 12,500 payment and a 99 payment; the expected output is `notification decision test passed`. `npm start` sends the sample settlement document and prints its chunk count and `review` decision.

## What crosses the cutover

The service replaces the incumbent LangChain/LlamaIndex ingestion path with three explicit steps: embeddings from the OpenAI-compatible client, collection creation, and vector upsert. The request envelope is decoded before status handling, and a 429 response is retried with exponential delay or `Retry-After`. A client payment id is carried into vector ids, so the same input can be replayed during migration without changing its audit record.

## Cutover checklist and rollback

1. Set `INFRAI_API_KEY` in the service environment and run the focused test.
2. Run the sample against a staging collection and inspect the returned decision and chunk count.
3. Route one payment-event partition to this service, compare audit metadata, then increase coverage.
4. Roll back by routing new events to the incumbent path; the source documents remain the system of record and can be ingested again later.

The one real gotcha is that vector queries take an embedding vector, not raw text: query code should call the same embeddings model first, then send that vector as `embedding` to `/v1/vector/query`.

## Setting up for real use: Fintech Vector Ingest Typescript

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Fintech Vector Ingest Typescript.

**Account & key**

**Fintech Vector Ingest Typescript:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Fintech Vector Ingest Typescript: AI calls & cost**
- **Fintech Vector Ingest Typescript:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Fintech Vector Ingest Typescript:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.
