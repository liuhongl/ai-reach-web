import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import * as React from 'react';
import { useState } from 'react';
import QuickWrapUp from './components/QuickWrapUp';
import WaitingPool from './components/WaitingPool';
import { useAgentCall } from './hooks/useAgentCall';
import { useAgentPresence } from './hooks/useAgentPresence';

jest.mock('livekit-client', () => ({
  ConnectionQuality: {},
  RoomEvent: {
    Disconnected: 'disconnected',
    TrackSubscribed: 'trackSubscribed',
    ConnectionQualityChanged: 'connectionQualityChanged',
  },
  Track: { Kind: { Audio: 'audio' } },
  Room: jest.fn(),
  createLocalAudioTrack: jest.fn(),
}));

const profile = {
  id: 'agent-profile-1',
  tenant_id: 'tenant-1',
  agent_identity: 'agent-1',
  user_id: 'user-1',
  enabled: true,
  scene_codes: ['intro_geo'] as const,
};

const handoff = {
  handoff_id: '9007199254740993',
  call_id: 'call-1',
  scene_code: 'intro_geo' as const,
  status: 'requested' as const,
  masked_contact: '138****0000',
  request_message: '请转人工',
  requested_at: '2026-07-22T08:00:00Z',
};

const credential = {
  handoff: { ...handoff, status: 'accepted' as const },
  livekit_url: 'wss://livekit.example.com',
  participant_token: 'agent-token',
  participant_identity: 'human-agent-9007199254740993',
};

const room = {
  connect: jest.fn().mockResolvedValue(undefined),
  publishMicrophone: jest.fn().mockResolvedValue(undefined),
  setMicrophoneEnabled: jest.fn().mockResolvedValue(undefined),
  switchAudioInput: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  onDisconnected: jest.fn(),
  onRemoteAudio: jest.fn(),
  onNetworkQuality: jest.fn(),
};
const roomFactory = () => room;

const presenceServices = {
  bootstrap: jest
    .fn()
    .mockResolvedValueOnce({
      code: 200,
      data: {
        profile,
        presence: { agent_identity: 'agent-1', status: 'offline' },
      },
    })
    .mockResolvedValue({
      code: 200,
      data: {
        profile,
        presence: { agent_identity: 'agent-1', status: 'available' },
      },
    }),
  online: jest.fn().mockResolvedValue({
    code: 200,
    data: { agent_identity: 'agent-1', status: 'available' },
  }),
  pause: jest.fn(),
  offline: jest.fn(),
  heartbeat: jest.fn().mockResolvedValue({
    code: 200,
    data: { agent_identity: 'agent-1', status: 'available' },
  }),
};

const claim = jest.fn().mockResolvedValue({ code: 200, data: credential });
const callServices = {
  mediaReady: jest.fn().mockResolvedValue({ code: 200 }),
  reconnectToken: jest.fn(),
  complete: jest.fn().mockResolvedValue({ code: 200 }),
};
const submit = jest.fn().mockResolvedValue({ code: 200 });

const WorkflowHarness = () => {
  const [activeCredential, setActiveCredential] = useState<any>();
  const agent = useAgentPresence({
    services: presenceServices as any,
    devicePreflight: async () => ({
      ok: true,
      checks: {
        microphone: 'passed',
        inputLevel: 'passed',
        audioPlayback: 'passed',
        browser: 'passed',
        network: 'passed',
      },
    }),
    heartbeatIntervalMs: 60_000,
  });
  const call = useAgentCall({
    credential: activeCredential,
    consoleSessionId: agent.consoleSessionId,
    roomFactory,
    services: callServices as any,
  });

  return (
    <div>
      <span data-testid="presence">{agent.status}</span>
      <span data-testid="call-phase">{call.phase}</span>
      {agent.status === 'offline' ? (
        <button type="button" onClick={() => void agent.goOnline()}>
          上线
        </button>
      ) : null}
      {!activeCredential ? (
        <WaitingPool
          handoffs={[handoff]}
          agentStatus={agent.status || 'offline'}
          consoleSessionId={agent.consoleSessionId}
          claim={claim}
          onClaimed={setActiveCredential}
          now={Date.parse('2026-07-22T08:00:20Z')}
        />
      ) : null}
      {call.phase === 'connected' ? (
        <button type="button" onClick={() => void call.endCall()}>
          结束通话
        </button>
      ) : null}
      {call.phase === 'ended' ? (
        <QuickWrapUp
          handoff={activeCredential.handoff}
          recordingStatus="processing"
          submit={submit}
          onSubmitted={() => agent.bootstrap()}
        />
      ) : null}
    </div>
  );
};

describe('agent workbench end-to-end state flow', () => {
  afterEach(() => {
    cleanup();
    sessionStorage.clear();
  });

  beforeEach(() => {
    Object.defineProperty(globalThis.crypto, 'randomUUID', {
      configurable: true,
      value: jest.fn(() => 'idempotency-key'),
    });
  });

  it('moves from bootstrap to available, claim, connected, complete, wrap-up and available', async () => {
    render(<WorkflowHarness />);
    await waitFor(() =>
      expect(screen.getByTestId('presence').textContent).toBe('offline'),
    );

    fireEvent.click(screen.getByRole('button', { name: '上线' }));
    await waitFor(() =>
      expect(screen.getByTestId('presence').textContent).toBe('available'),
    );

    fireEvent.click(screen.getByRole('button', { name: /接管通话/ }));
    await waitFor(() =>
      expect(screen.getByTestId('call-phase').textContent).toBe('connected'),
    );
    expect(callServices.mediaReady).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: '结束通话' }));
    await waitFor(() => expect(screen.getByText('快速话后确认')).toBeTruthy());
    fireEvent.click(screen.getByText('已解决'));
    fireEvent.click(screen.getByText('无需跟进'));
    fireEvent.click(screen.getByRole('button', { name: '提交并恢复接听' }));

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByTestId('presence').textContent).toBe('available'),
    );
    expect(claim).toHaveBeenCalledTimes(1);
    expect(callServices.complete).toHaveBeenCalledTimes(1);
  });
});
