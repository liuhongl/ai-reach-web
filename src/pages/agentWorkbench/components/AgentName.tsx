import * as React from 'react';
import { useEffect, useState } from 'react';
import {
  type AdminAgentDto,
  listAdminAgents,
} from '@/services/ruoyi/agent-console';

type AgentNameMap = Record<string, string>;

let agentNamesPromise: Promise<AgentNameMap> | undefined;

const loadAgentNames = () => {
  agentNamesPromise ??= listAdminAgents({ pageSize: 100 }).then((response) => {
    const data =
      response && typeof response === 'object' && Reflect.get(response, 'data')
        ? Reflect.get(response, 'data')
        : response;
    const rows =
      data &&
      typeof data === 'object' &&
      Array.isArray(Reflect.get(data, 'rows'))
        ? (Reflect.get(data, 'rows') as AdminAgentDto[])
        : [];
    return Object.fromEntries(
      rows.map((row) => [
        row.agent_identity,
        row.nick_name || row.user_name || row.agent_identity,
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
