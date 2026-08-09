import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import * as React from 'react';
import { connectAiCallLabRoom } from '@/pages/aiCallLab/customer/livekitClient';
import {
  getAiCallRuntimeBrowserToken,
  reportAiCallTaskBrowserEvent,
} from '../service';
import WebTaskCallModal from './WebTaskCallModal';

jest.mock('@/pages/aiCallLab/customer/livekitClient', () => ({
  connectAiCallLabRoom: jest.fn(),
}));

jest.mock('../service', () => ({
  getAiCallRuntimeBrowserToken: jest.fn(),
  reportAiCallTaskBrowserEvent: jest.fn(),
}));

const connectRoomMock = connectAiCallLabRoom as jest.Mock;
const getTokenMock = getAiCallRuntimeBrowserToken as jest.Mock;
const reportBrowserEventMock = reportAiCallTaskBrowserEvent as jest.Mock;

describe('WebTaskCallModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getTokenMock.mockResolvedValue({
      callId: 'call-1',
      livekitUrl: 'ws://127.0.0.1:7880',
      participantToken: 'token-1',
    });
    reportBrowserEventMock.mockResolvedValue(undefined);
  });

  it('closes when LiveKit disconnects remotely', async () => {
    let onDisconnected: (() => void) | undefined;
    connectRoomMock.mockImplementation(
      async (_session, disconnected?: () => void) => {
        onDisconnected = disconnected;
        return {
          disconnect: jest.fn(),
          setMicrophoneEnabled: jest.fn(),
        };
      },
    );
    const onClosed = jest.fn();

    render(<WebTaskCallModal callId="call-1" open onClosed={onClosed} />);
    fireEvent.click(screen.getByRole('button', { name: /接听/ }));

    await screen.findByText('Web 通话中');
    expect(onDisconnected).toBeDefined();

    act(() => onDisconnected?.());

    await waitFor(() => expect(onClosed).toHaveBeenCalledWith('call-1'));
    expect(reportBrowserEventMock).toHaveBeenCalledWith(
      'call-1',
      'browser_ready',
    );
    expect(reportBrowserEventMock).not.toHaveBeenCalledWith(
      'call-1',
      'browser_disconnect',
    );
  });
});
