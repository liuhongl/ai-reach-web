import fs from 'node:fs';
import path from 'node:path';

const sourcePath = path.join(__dirname, 'processing.tsx');

describe('follow-up processing page', () => {
  it('only exposes the agent work queue and its closed-loop actions', () => {
    const source = fs.readFileSync(sourcePath, 'utf8');
    for (const text of [
      'title="回访任务"',
      'FollowUpPanel',
      'useAgentPresence',
      'useFollowUpCallback',
      'callbackEnabled',
      'consoleSessionId={agent.consoleSessionId}',
      'onCallAccepted',
    ])
      expect(source).toContain(text);
    expect(source).not.toContain('全量管理');
    expect(source).not.toContain('任务转交');
    expect(source).not.toContain('批量分配');
    expect(source).not.toContain('修改正常结果');
  });

  it('keeps callback controls in a modal and enters handling result after ending', () => {
    const source = fs.readFileSync(sourcePath, 'utf8');
    for (const text of [
      'message.useMessage',
      '<Modal',
      'open={Boolean(callback)}',
      "agent.status === 'available' || agent.goOnline()",
      'handlingTaskToOpen',
      'callId',
      'onEndCall={endCallbackCall}',
    ])
      expect(source).toContain(text);
    expect(source).not.toContain('agent-follow-up-current-call');
    expect(source).not.toContain('<Alert');
  });
});
