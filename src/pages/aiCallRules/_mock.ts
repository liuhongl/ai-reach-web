import type { Request, Response } from 'express';
import type {
  AiCallRule,
  AiCallRuleMetadata,
  CallRuleFormValue,
} from './domain';

const metadata: AiCallRuleMetadata = {
  maxRetryCount: 5,
  retryableResults: [
    { value: 'no_answer', label: '无人接听' },
    { value: 'busy', label: '忙线' },
    { value: 'rejected', label: '拒接' },
  ],
};

let rules: AiCallRule[] = [
  {
    ruleId: 'rule-workday',
    ruleName: '工作日规则',
    enabled: true,
    callWindows: [
      { startTime: '09:00', endTime: '12:00' },
      { startTime: '14:00', endTime: '18:00' },
    ],
    retryCount: 2,
    retryIntervalsMinutes: [30, 60],
    retryableResults: ['no_answer', 'busy'],
    updatedAt: '2026-07-27 10:00:00',
  },
  {
    ruleId: 'rule-evening',
    ruleName: '晚间通知规则',
    enabled: false,
    callWindows: [{ startTime: '18:00', endTime: '20:00' }],
    retryCount: 1,
    retryIntervalsMinutes: [30],
    retryableResults: ['no_answer'],
    updatedAt: '2026-07-26 18:00:00',
  },
];

let createdCount = 0;

const success = <T>(res: Response, data: T, msg = '操作成功') =>
  res.json({ code: 200, msg, data });

const page = <T>(res: Response, rows: T[], total = rows.length) =>
  res.json({ code: 200, msg: '查询成功', rows, total });

const getRouteParam = (req: Request, key: string): string => {
  const value = req.params[key];
  return Array.isArray(value) ? value[0] : String(value || '');
};

const findRuleIndex = (ruleId: string) =>
  rules.findIndex((item) => item.ruleId === ruleId);

const toRule = (ruleId: string, payload: CallRuleFormValue): AiCallRule => ({
  ...payload,
  ruleId,
  updatedAt: '2026-07-27 10:00:00',
});

export default {
  'GET /ai-call-agent-api/ai-call/outbound-rules/meta': (
    _req: Request,
    res: Response,
  ) => success(res, metadata),

  'GET /ai-call-agent-api/ai-call/outbound-rules': (
    req: Request,
    res: Response,
  ) => {
    const ruleName = String(req.query.ruleName || '').trim();
    const enabled = req.query.enabled;
    const filtered = rules.filter((rule) => {
      const matchesName = !ruleName || rule.ruleName.includes(ruleName);
      const matchesEnabled =
        enabled === undefined || rule.enabled === (String(enabled) === 'true');
      return matchesName && matchesEnabled;
    });
    const pageNum = Math.max(Number(req.query.pageNum) || 1, 1);
    const pageSize = Math.max(Number(req.query.pageSize) || 20, 1);
    const start = (pageNum - 1) * pageSize;
    return page(res, filtered.slice(start, start + pageSize), filtered.length);
  },

  'POST /ai-call-agent-api/ai-call/outbound-rules': (
    req: Request,
    res: Response,
  ) => {
    createdCount += 1;
    const rule = toRule(`rule-created-${createdCount}`, req.body);
    rules = [rule, ...rules];
    return success(res, rule, '创建成功');
  },

  'PUT /ai-call-agent-api/ai-call/outbound-rules/:ruleId': (
    req: Request,
    res: Response,
  ) => {
    const ruleId = getRouteParam(req, 'ruleId');
    const index = findRuleIndex(ruleId);
    if (index < 0) {
      return res.status(404).json({ code: 404, msg: '呼叫规则不存在' });
    }
    const rule = toRule(ruleId, req.body);
    rules[index] = rule;
    return success(res, rule, '更新成功');
  },

  'DELETE /ai-call-agent-api/ai-call/outbound-rules/:ruleId': (
    req: Request,
    res: Response,
  ) => {
    const ruleId = getRouteParam(req, 'ruleId');
    if (findRuleIndex(ruleId) < 0) {
      return res.status(404).json({ code: 404, msg: '呼叫规则不存在' });
    }
    rules = rules.filter((item) => item.ruleId !== ruleId);
    return res.json({ code: 200, msg: '删除成功' });
  },
};
