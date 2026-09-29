/**
 * Safely parses API responses to prevent `SyntaxError: Unexpected token 'T'...`
 * when servers return plain-text errors (such as 429 Too Many Requests, 502 Bad Gateway, 500, etc.)
 */
export async function parseApiResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  let data = null;

  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    if (data && (data.error || data.message)) {
      throw new Error(data.error || data.message);
    }
    const text = !data ? await response.text().catch(() => '') : '';
    if (response.status === 429) {
      throw new Error('Server rate limit reached. Please wait a moment and try again.');
    }
    if (response.status === 502 || response.status === 503) {
      throw new Error('Backend service is temporarily unavailable or restarting. Please try again in a few seconds.');
    }
    throw new Error(text || `Request failed with HTTP status ${response.status}`);
  }

  if (data !== null) return data;
  return await response.json().catch(() => ({ success: true }));
}
