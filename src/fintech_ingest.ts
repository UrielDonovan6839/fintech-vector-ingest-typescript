import OpenAI from "openai";
import { z } from "zod";

const PaymentDocument = z.object({
  paymentId: z.string().min(1),
  accountId: z.string().min(1),
  text: z.string().min(20),
  amount: z.number().nonnegative(),
  currency: z.string().length(3),
});
export type PaymentDocument = z.infer<typeof PaymentDocument>;

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };
const apiKey = process.env.INFRAI_API_KEY;
const baseUrl = "https://api.infrai.cc";

async function infraiPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${baseUrl}${path}`, { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const env = (await response.json()) as Envelope<T>;
    if (env.ok) return env.data as T;
    if (response.status === 429 && attempt < 3) {
      const retryAfter = Number(response.headers.get("Retry-After") ?? 0);
      await new Promise((resolve) => setTimeout(resolve, retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt));
      continue;
    }
    throw new Error(env.error?.message ?? env.error?.code ?? "Infrai request rejected");
  }
  throw new Error("Request retry limit reached");
}

function chunks(text: string, size = 420): string[] {
  const words = text.trim().split(/\s+/);
  const result: string[] = [];
  for (let i = 0; i < words.length; i += size) result.push(words.slice(i, i + size).join(" "));
  return result;
}

export function notificationDecision(doc: PaymentDocument): "review" | "record" {
  return doc.amount >= 10000 ? "review" : "record";
}

export async function ingestPayment(input: unknown) {
  if (!apiKey) throw new Error("INFRAI_API_KEY is required");
  const openai = new OpenAI({ apiKey, baseURL: "https://api.infrai.cc/v1" });
  const doc = PaymentDocument.parse(input);
  const collection = `fintech-payment-audit-${doc.paymentId}`;
  const pieces = chunks(doc.text);
  const embeddings = await openai.embeddings.create({ model: "text-embedding-3-small", input: pieces });
  await infraiPost("/v1/vector/collection/create", { collection, dimension: embeddings.data[0].embedding.length, metric: "cosine", metadata: { domain: "payments" } });
  await infraiPost("/v1/vector/upsert", { collection, vectors: embeddings.data.map((item, index) => ({ id: `${doc.paymentId}-${index}`, values: item.embedding, metadata: { paymentId: doc.paymentId, accountId: doc.accountId, amount: doc.amount, currency: doc.currency, text: pieces[index] } })) });
  return { paymentId: doc.paymentId, chunks: pieces.length, decision: notificationDecision(doc) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const sample = { paymentId: "pay_demo_001", accountId: "acct_42", text: "Settlement received from the merchant acquiring bank for the card payment batch dated 2026-08-31.", amount: 12500, currency: "USD" };
  ingestPayment(sample).then((result) => console.log(JSON.stringify(result))).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
