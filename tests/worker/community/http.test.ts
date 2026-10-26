import { deviceRegistrationSchema } from '@/lib/community/schema';
import { MAX_BODY_BYTES, parseJsonBody } from '@/worker/community/http';
import { handleCommunityRequest } from '@/worker/community/index';
import { createMemoryStore } from '@/worker/community/memory_store';

function streamRequest(body: ReadableStream<Uint8Array>, headers?: HeadersInit): Request {
  const init: RequestInit & { duplex: 'half' } = {
    method: 'POST',
    body,
    headers,
    duplex: 'half',
  };
  return new Request('https://api.deadair.test/community/auth/device', init);
}

describe('community JSON body reader', () => {
  it.each([undefined, '1'])(
    'cancels an oversized stream with Content-Length %p before consuming it all',
    async (declaredLength) => {
      let chunks = 0;
      const cancel = jest.fn();
      const body = new ReadableStream<Uint8Array>({
        pull(controller): void {
          chunks += 1;
          controller.enqueue(new Uint8Array(1024).fill(32));
          if (chunks === 100) controller.close();
        },
        cancel,
      });
      const request = streamRequest(
        body,
        declaredLength === undefined ? undefined : { 'Content-Length': declaredLength },
      );
      const response = await handleCommunityRequest(request, {
        COMMUNITY_ENABLED: 'on',
        COMMUNITY_STORE: createMemoryStore(),
      });
      expect(response.status).toBe(413);
      await expect(response.json()).resolves.toMatchObject({
        error: { code: 'payload_too_large' },
      });
      expect(cancel).toHaveBeenCalledTimes(1);
      expect(chunks).toBeLessThan(100);
      expect(body.locked).toBe(false);
    },
  );

  it('cancels a body whose declared size exceeds the limit', async () => {
    const cancel = jest.fn();
    const body = new ReadableStream<Uint8Array>({ cancel });
    const result = await parseJsonBody(
      streamRequest(body, { 'Content-Length': String(MAX_BODY_BYTES + 1) }),
      deviceRegistrationSchema,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(413);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it.each([MAX_BODY_BYTES, MAX_BODY_BYTES + 1])(
    'counts UTF-8 bytes for a %i-byte JSON body with split characters',
    async (size) => {
      const bytes = new TextEncoder().encode(JSON.stringify({ displayName: 'Écho 🎵' }));
      const padded = new Uint8Array(size).fill(32);
      padded.set(bytes);
      const body = new ReadableStream<Uint8Array>({
        start(controller): void {
          controller.enqueue(padded.slice(0, 17));
          controller.enqueue(padded.slice(17));
          controller.close();
        },
      });
      const result = await parseJsonBody(streamRequest(body), deviceRegistrationSchema);
      if (size === MAX_BODY_BYTES) {
        expect(result).toEqual({ ok: true, value: { displayName: 'Écho 🎵' } });
      } else {
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.response.status).toBe(413);
      }
      expect(body.locked).toBe(false);
    },
  );

  it.each([
    ['', true, 200],
    ['', false, 400],
    ['{', false, 400],
    ['{"displayName":42}', false, 400],
  ] as const)('handles body %p with allowEmpty=%p', async (body, allowEmpty, status) => {
    const request = new Request('https://api.deadair.test/community/auth/device', {
      method: 'POST',
      body: body || undefined,
    });
    const result = await parseJsonBody(request, deviceRegistrationSchema, { allowEmpty });
    expect(result.ok).toBe(status === 200);
    if (!result.ok) expect(result.response.status).toBe(status);
    else expect(result.value).toEqual({});
  });
});
