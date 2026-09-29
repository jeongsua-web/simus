export type SessionStatus = "RUNNING" | "CLOSING" | "FINALIZED";
export type Choice = { id: string; label: string };
export type Situation = { id: string; code?: string; title: string; body: string; choices: Choice[] };
export type Session = {
  id: string; name: string; status: SessionStatus; accepting_choices: boolean;
  auto_cutoff_at?: string | null; starts_at?: string | null; scheduled_end_at?: string | null; finalized_at?: string | null;
  situations: Situation[];
};
export type LatestSession = Omit<Session, "accepting_choices" | "situations"> & {
  response_count: number; situation_count: number;
};
export type OwnResponse = { situation_id: string; choice_id: string; received_at: string };
export type Submission = { session_id: string; situation_id: string; choice_id: string; request_key: string };
export type ApiError = { error?: { code?: string; message?: string } };
