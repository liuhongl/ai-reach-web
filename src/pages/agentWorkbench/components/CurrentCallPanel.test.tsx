import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import * as React from 'react';
import CurrentCallPanel from './CurrentCallPanel';

describe('CurrentCallPanel', () => {
  afterEach(cleanup);

  it('shows the concrete media connection stage while claiming', () => {
    render(
      <CurrentCallPanel
        phase="connecting"
        connectionStage="microphone_publishing"
        microphoneEnabled
        remoteAudioReady={false}
        networkQuality="unknown"
        onToggleMicrophone={jest.fn()}
        onSwitchAudioInput={jest.fn()}
        onEndCall={jest.fn()}
      />,
    );

    expect(screen.getByText('正在发布麦克风')).toBeTruthy();
  });

  it('uses callback-specific confirmation copy when supplied', () => {
    render(
      <CurrentCallPanel
        phase="connected"
        connectionStage="connected"
        microphoneEnabled
        remoteAudioReady={false}
        networkQuality="good"
        endConfirmDescription="结束后回到当前跟进任务。"
        onToggleMicrophone={jest.fn()}
        onSwitchAudioInput={jest.fn()}
        onEndCall={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '结束客户通话' }));
    expect(screen.getByText('结束后回到当前跟进任务。')).toBeTruthy();
  });
});
