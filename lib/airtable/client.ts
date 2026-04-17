// Minimal Airtable REST client — we intentionally avoid the `airtable` npm
// package so this works the same in Next.js, scripts, and Edge Functions.

import { serverEnv } from "@/lib/env";

const BASE_URL = "https://api.airtable.com/v0";
const REQUESTS_PER_SECOND = 4; // leave headroom under the 5 r/s limit

export class AirtableClient {
  private apiKey: string;
  private lastRequestAt = 0;

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? serverEnv().airtableApiKey;
  }

  private async throttle() {
    const minInterval = 1000 / REQUESTS_PER_SECOND;
    const elapsed = Date.now() - this.lastRequestAt;
    if (elapsed < minInterval) {
      await new Promise((r) => setTimeout(r, minInterval - elapsed));
    }
    this.lastRequestAt = Date.now();
  }

  private async fetch<T>(url: string, init?: RequestInit): Promise<T> {
    await this.throttle();
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 2000));
      return this.fetch(url, init);
    }
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Airtable ${res.status}: ${text}`);
    }
    return (await res.json()) as T;
  }

  async *listAll<T = AirtableRecord>(
    baseId: string,
    tableId: string,
    params: { filterByFormula?: string; fields?: string[]; pageSize?: number } = {},
  ): AsyncGenerator<T> {
    let offset: string | undefined;
    do {
      const qs = new URLSearchParams();
      if (params.filterByFormula) qs.set("filterByFormula", params.filterByFormula);
      if (params.pageSize) qs.set("pageSize", params.pageSize.toString());
      if (offset) qs.set("offset", offset);
      for (const f of params.fields ?? []) qs.append("fields[]", f);
      const url = `${BASE_URL}/${baseId}/${tableId}?${qs.toString()}`;
      const body = await this.fetch<{ records: T[]; offset?: string }>(url);
      for (const record of body.records) yield record;
      offset = body.offset;
    } while (offset);
  }

  async batchUpdate(baseId: string, tableId: string, records: Array<{ id: string; fields: Record<string, unknown> }>) {
    const chunks = chunk(records, 10);
    for (const c of chunks) {
      await this.fetch(`${BASE_URL}/${baseId}/${tableId}`, {
        method: "PATCH",
        body: JSON.stringify({ records: c, typecast: true }),
      });
    }
  }

  async batchCreate(baseId: string, tableId: string, records: Array<{ fields: Record<string, unknown> }>) {
    const chunks = chunk(records, 10);
    const created: AirtableRecord[] = [];
    for (const c of chunks) {
      const body = await this.fetch<{ records: AirtableRecord[] }>(
        `${BASE_URL}/${baseId}/${tableId}`,
        { method: "POST", body: JSON.stringify({ records: c, typecast: true }) },
      );
      created.push(...body.records);
    }
    return created;
  }
}

export interface AirtableRecord<F = Record<string, unknown>> {
  id: string;
  createdTime: string;
  fields: F;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}
