import * as React from 'react';
import { useEffect, useState } from 'react';
import {
  type AdminAgentDto,
  listAdminAgents,
} from '@/services/ruoyi/agent-console';
import { listUsers, type RuoyiUser } from '@/services/ruoyi/user';

type AgentNameMap = Record<string, string>;

let agentNamesPromise: Promise<AgentNameMap> | undefined;

const pageRows = <T,>(response: unknown): T[] => {
  if (!response || typeof response !== 'object') return [];
  const data = Reflect.get(response, 'data');
  const rows =
    Reflect.get(response, 'rows') ||
    (data && typeof data === 'object' ? Reflect.get(data, 'rows') : undefined);
  return Array.isArray(rows) ? (rows as T[]) : [];
};

const loadAgentNames = () => {
  agentNamesPromise ??= Promise.all([
    listAdminAgents({ pageSize: 100 }),
    listUsers({ pageNum: 1, pageSize: 100 }).catch(() => undefined),
  ]).then(([agentResponse, userResponse]) => {
    const agents = pageRows<AdminAgentDto>(agentResponse);
    const userNames = new Map<string, string>();
    for (const user of pageRows<RuoyiUser>(userResponse)) {
      const name = user.nickName || user.userName;
      if (user.userId != null && name) userNames.set(String(user.userId), name);
    }
    return Object.fromEntries(
      agents.map((row) => [
        row.agent_identity,
        userNames.get(String(row.user_id)) ||
          row.nick_name ||
          row.user_name ||
          row.agent_identity,
      ]),
    );
  });
  return agentNamesPromise;
};

type AgentNameProps = {
  emptyText?: string;
  identity?: string | null;
};

const AgentName = ({ emptyText = '-', identity }: AgentNameProps) => {
  const [names, setNames] = useState<AgentNameMap>({});

  useEffect(() => {
    let active = true;
    void loadAgentNames()
      .then((nextNames) => {
        if (active) setNames(nextNames);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  return <>{identity ? names[identity] || identity : emptyText}</>;
};

export default AgentName;
