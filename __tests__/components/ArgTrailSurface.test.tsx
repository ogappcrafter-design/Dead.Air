// __tests__/components/ArgTrailSurface.test.tsx
// DEA-91: the trail surface must stay silent until the player investigates,
// and the DECODE action must print the registry row the matrix carries.

import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { ArgSignalBleed } from '../../components/arg/ArgSignalBleed';
import { ScanlineTrace } from '../../components/arg/ScanlineTrace';
import { ARG_FRAGMENTS, ARG_TRACES } from '../../data/arg';
import { buildTraceGrid, getTrailLog, resolveTraceArtifact } from '../../engine/arg/ArgTrail';
import { glyphMatrixRows } from '../../engine/arg/GlyphCodec';

const EMPTY_LOG = getTrailLog({
  decodedTraceIds: [],
  heardFragmentIds: [],
  hiddenCallPlayed: false,
});

describe('ScanlineTrace', () => {
  it('renders one mono row per matrix row', async () => {
    const grid = buildTraceGrid(ARG_TRACES[0]!, 4);
    const view = await render(<ScanlineTrace grid={grid} intensity={0.3} />);
    expect(view.getByTestId('arg-scanline-trace')).toBeTruthy();
    expect(view.getAllByText(/^[█·]{13}$/)).toHaveLength(glyphMatrixRows(grid).length);
  });
});

describe('ArgSignalBleed', () => {
  it('renders nothing when there is no trail activity', async () => {
    const view = await render(
      <ArgSignalBleed
        activeTrace={null}
        activeFragment={null}
        log={EMPTY_LOG}
        resolved={false}
        onDecode={() => null}
        onFile={() => undefined}
      />,
    );
    expect(view.toJSON()).toBeNull();
  });

  it('offers DECODE for a visible trace and prints the decoded row', async () => {
    const trace = ARG_TRACES[0]!;
    const artifact = resolveTraceArtifact(trace, 4);
    const onDecode = jest.fn(() => artifact);

    const view = await render(
      <ArgSignalBleed
        activeTrace={trace}
        activeFragment={null}
        log={EMPTY_LOG}
        resolved={false}
        onDecode={onDecode}
        onFile={() => undefined}
      />,
    );

    expect(view.getByText('TRACE DETECTED — UNRESOLVED')).toBeTruthy();
    await act(async () => {
      fireEvent.press(view.getByTestId('arg-decode-trace'));
    });
    expect(onDecode).toHaveBeenCalledTimes(1);
    expect(view.getByText(artifact.payload)).toBeTruthy();
    expect(view.getByText(/GREYFIELD EXCHANGE/)).toBeTruthy();
  });

  it('renders a bleed and files it on demand', async () => {
    const fragment = ARG_FRAGMENTS[0]!;
    const onFile = jest.fn();

    const view = await render(
      <ArgSignalBleed
        activeTrace={null}
        activeFragment={fragment}
        log={EMPTY_LOG}
        resolved={false}
        onDecode={() => null}
        onFile={onFile}
      />,
    );

    expect(view.getByText(fragment.label)).toBeTruthy();
    expect(view.getByText(fragment.text[0]!)).toBeTruthy();
    await act(async () => {
      fireEvent.press(view.getByTestId('arg-file-fragment'));
    });
    expect(onFile).toHaveBeenCalledTimes(1);
  });

  it('shows the collected log collapsed, then expands it', async () => {
    const log = getTrailLog({
      decodedTraceIds: ['trace-row-23', 'trace-row-46'],
      heardFragmentIds: ['frag-count-47'],
      hiddenCallPlayed: false,
    });

    const view = await render(
      <ArgSignalBleed
        activeTrace={null}
        activeFragment={null}
        log={log}
        resolved={false}
        onDecode={() => null}
        onFile={() => undefined}
      />,
    );

    expect(view.getByText('ROWS 2/3')).toBeTruthy();
    expect(view.queryByText(/RELAY 23 · 101.9/)).toBeNull();
    await act(async () => {
      fireEvent.press(view.getByTestId('arg-trail-log-toggle'));
    });
    expect(view.getByText(/RELAY 23 · 101.9/)).toBeTruthy();
  });
});
