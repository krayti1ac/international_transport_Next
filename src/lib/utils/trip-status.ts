export const KANBAN_STAGE_MAP: Record<string, string> = {
  pendingAssignment: 'pending',
  outbound: 'en_route_outbound',
  pendingReturn: 'at_destination_export',
  returnRoute: 'en_route_inbound',
  settled: 'completed',
};

export const DB_TO_KANBAN_STAGE: Record<string, string> = {
  pending: 'pendingAssignment',
  planned: 'pendingAssignment',
  assigned: 'pendingAssignment',
  en_route_outbound: 'outbound',
  in_transit: 'outbound',
  customs_export: 'outbound',
  at_destination_export: 'pendingReturn',
  pending_return: 'pendingReturn',
  en_route_inbound: 'returnRoute',
  customs_import: 'returnRoute',
  completed: 'settled',
  settled: 'settled',
  delivered: 'settled',
};

export function mapDbStatusToKanbanStage(status?: string | null): string {
  if (!status) return 'pendingAssignment';
  if (DB_TO_KANBAN_STAGE[status]) return DB_TO_KANBAN_STAGE[status];
  if (KANBAN_STAGE_MAP[status]) return status;
  return 'pendingAssignment';
}

export function mapKanbanStageToDbStatus(stage: string): string {
  return KANBAN_STAGE_MAP[stage] || stage;
}
