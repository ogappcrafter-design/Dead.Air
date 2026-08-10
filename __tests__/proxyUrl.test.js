import { PROXY_REASONS, resolveProxyUrl } from '../src/engine/proxyUrl';

const ok = (raw) => {
  const { url, reason } = resolveProxyUrl(raw);
  expect(reason).toBeNull();
  return url;
};

const rejected = (raw) => {
  const { url, reason } = resolveProxyUrl(raw);
  expect(url).toBeNull();
  return reason;
};

describe('resolveProxyUrl', () => {
  it('accepts an https endpoint', () => {
    expect(ok('https://dead-air-proxy-abc.run.app')).toBe('https://dead-air-proxy-abc.run.app');
  });

  it('normalises trailing slashes and whitespace so paths join cleanly', () => {
    expect(ok('  https://example.com/  ')).toBe('https://example.com');
    expect(ok('https://example.com///')).toBe('https://example.com');
    expect(ok('https://example.com/signal/')).toBe('https://example.com/signal');
  });

  it('keeps an explicit port and lowercases the scheme', () => {
    expect(ok('HTTPS://example.com:8443')).toBe('https://example.com:8443');
  });

  it('reports an unset proxy rather than guessing one', () => {
    [null, undefined, '', '   ', 42, {}].forEach((raw) => {
      expect(rejected(raw)).toBe(PROXY_REASONS.unset);
    });
  });

  it('refuses plaintext http on a real host', () => {
    // A shipped build talking to the proxy over http would expose the traffic
    // and make the endpoint trivial to hijack.
    expect(rejected('http://dead-air-proxy.example.com')).toBe(PROXY_REASONS.insecure);
  });

  it('allows plaintext only where it can only be a dev machine', () => {
    [
      'http://localhost:8080',
      'http://127.0.0.1:8080',
      'http://10.0.2.2:8080', // android emulator's host loopback
      'http://192.168.1.14:8080',
      'http://172.16.4.4:8080',
      'http://mac-mini.local:8080',
    ].forEach((raw) => expect(resolveProxyUrl(raw).reason).toBeNull());
  });

  it('does not mistake a lookalike host for a private one', () => {
    ['http://10.evil.com', 'http://192.168.1.14.evil.com', 'http://172.32.0.1'].forEach((raw) => {
      expect(rejected(raw)).toBe(PROXY_REASONS.insecure);
    });
  });

  it('rejects anything that is not a plain http(s) URL', () => {
    ['not a url', 'ftp://example.com', 'javascript:alert(1)', '//example.com', 'https://'].forEach(
      (raw) => expect(rejected(raw)).toBe(PROXY_REASONS.malformed),
    );
  });

  it('rejects a URL carrying a query or fragment, which would break path joining', () => {
    expect(rejected('https://example.com/?a=1')).toBe(PROXY_REASONS.malformed);
  });

  it('gives every rejection a reason fit to show the player', () => {
    Object.values(PROXY_REASONS)
      .filter(Boolean)
      .forEach((reason) => expect(reason).toMatch(/^[A-Z ]+$/));
  });
});
