/**
 * Minimal client for Substack's unofficial, undocumented internal API — the
 * same endpoints Substack's own web editor calls. There is no public/official
 * API for creating posts (see FR-019 discussion for sources). This talks to
 * it by replaying a logged-in session cookie, exactly like python-substack
 * and similar community tools do.
 *
 * Field names below (`draft_title`, `draft_subtitle`, `draft_body`, `type`)
 * are the best current public knowledge, reconstructed from reverse-engineering
 * write-ups (e.g. AnthonyDavidAdams/substack-api-reference) — NOT verified
 * against this account's live Substack. The first real (non-dry-run) run
 * should be treated as the actual verification step; see the FR's Testing
 * Guide for what to check and how to adjust if the shape is off.
 *
 * Because this hits an unversioned, unofficial surface, it can break without
 * notice if Substack changes their internal editor. Failures here should
 * never be treated as "the article wasn't good enough" — they mean the
 * client needs updating.
 */

export interface SubstackCredentials {
  /** e.g. "https://fantasyvreality.substack.com" — no trailing slash */
  publicationUrl: string;
  /** Full Cookie request header value copied from a logged-in browser session; must include substack.sid */
  cookie: string;
}

export interface CreateDraftParams {
  title: string;
  subtitle?: string;
  bodyHtml: string;
}

export interface CreateDraftResult {
  id: string;
  raw: unknown;
}

export async function createSubstackDraft(
  creds: SubstackCredentials,
  params: CreateDraftParams,
): Promise<CreateDraftResult> {
  const url = `${creds.publicationUrl.replace(/\/$/, '')}/api/v1/drafts`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: creds.cookie,
    },
    body: JSON.stringify({
      draft_title: params.title,
      draft_subtitle: params.subtitle ?? '',
      draft_body: params.bodyHtml,
      type: 'newsletter',
    }),
  });

  const rawText = await res.text();
  let data: any = null;
  try { data = rawText ? JSON.parse(rawText) : null; } catch { /* non-JSON response */ }

  if (!res.ok) {
    throw new Error(
      `Substack draft creation failed: HTTP ${res.status} ${res.statusText} — ${rawText.slice(0, 500)}`,
    );
  }

  const id = data?.id ?? data?.draft?.id;
  if (id === undefined || id === null) {
    throw new Error(
      `Substack returned 2xx but no recognizable draft id — response shape may have changed: ${rawText.slice(0, 500)}`,
    );
  }

  return { id: String(id), raw: data };
}
