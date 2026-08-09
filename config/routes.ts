type AiReachRoute = {
  path: string;
  component: string;
  layout?: boolean;
  hideInMenu?: boolean;
  access?: string;
  requiredPermission?: string;
};

const protectedRoute = (
  path: string,
  component: string,
  requiredPermission: string,
): AiReachRoute => ({
  path,
  component,
  hideInMenu: true,
  access: 'hasRoutePermission',
  requiredPermission,
});

const routes: AiReachRoute[] = [
  { path: '/user/login', component: './user/login', layout: false },
  { path: '/', component: './index' },
  protectedRoute('/ai-call/tasks', './aiCallTasks', 'ai_call:agent:manage'),
  protectedRoute(
    '/ai-call/records',
    './aiCallRecords',
    'ai_call:agent:manage',
  ),
  protectedRoute('/ai-call/voices', './aiCallVoices', 'ai_call:voice:manage'),
  protectedRoute('/ai-call/lines', './aiCallLines', 'ai_call:agent:manage'),
  protectedRoute('/ai-call/rules', './aiCallRules', 'ai_call:agent:manage'),
  protectedRoute(
    '/ai-call/follow-ups',
    './agentWorkbench/admin/followUps/processing',
    'ai_call:agent:console',
  ),
  protectedRoute(
    '/ai-call/follow-up-overview',
    './agentWorkbench/admin/followUps/overview',
    'ai_call:agent:manage',
  ),
  protectedRoute(
    '/ai-call/statistics',
    './aiCallStatistics',
    'ai_call:agent:manage',
  ),
  protectedRoute(
    '/ai-call/agent-workbench',
    './agentWorkbench',
    'ai_call:agent:console',
  ),
  protectedRoute(
    '/ai-call/agents',
    './agentWorkbench/admin/agents',
    'ai_call:agent:manage',
  ),
  protectedRoute(
    '/ai-call/handoffs',
    './agentWorkbench/admin/handoffs',
    'ai_call:agent:manage',
  ),
  protectedRoute(
    '/ai-call-lab/customer',
    './aiCallLab/customer',
    'ai_call:lab:use',
  ),
  protectedRoute(
    '/ai-call-lab/prompt-config',
    './aiCallLab/promptConfig',
    'ai_call:prompt:manage',
  ),
  protectedRoute(
    '/ai-call/tasks/create',
    './aiCallTasks/create',
    'ai_call:agent:manage',
  ),
  protectedRoute(
    '/ai-call/tasks/:taskId',
    './aiCallTasks/detail',
    'ai_call:agent:manage',
  ),
  { path: '/403', component: './exception/403' },
  { path: '/*', component: './exception/404' },
];

export default routes;
