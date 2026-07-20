import { api, buildQueryString } from './client';

export interface AuditLogResponse {
  id: string;
  action: string;
  actor: {
    id: string;
    email: string;
  };
  resource: {
    type: string;
    id?: string;
  };
  sessionId?: string;
  details: Record<string, any>;
  metadata: Record<string, any>;
  timestamp: string;
}

export interface GetAuditLogsOptions {
  resource_type?: string;
  resource_id?: string;
  actor_id?: string;
  actor_email?: string;
  action?: string;
  session_id?: string;
  from_date?: string;
  to_date?: string;
  limit?: number;
  skip?: number;
}

export async function getAuditLogs(options: GetAuditLogsOptions = {}): Promise<AuditLogResponse[]> {
  const query = buildQueryString(options);
  return api.get<AuditLogResponse[]>(`/api/v1/audit-logs${query}`);
}
