-- Owner only. psql -v runtime_role=simus_runtime -f prototype/sql/05_runtime_role.sql
-- Create LOGIN role/password separately; never use the owner in the HTTP server.
BEGIN;
GRANT USAGE ON SCHEMA simus TO :"runtime_role";
GRANT SELECT ON ALL TABLES IN SCHEMA simus TO :"runtime_role";
GRANT INSERT ON simus.simulation_sessions,simus.participants,simus.participant_credentials,
 simus.participant_sessions,simus.participant_alignments,simus.session_regions,
 simus.session_situations,simus.session_choices,simus.choice_region_effects,
 simus.city_states,simus.region_states,simus.choice_records,simus.choice_record_region_effects,
 simus.session_closures,simus.session_results,simus.region_results,simus.participant_results TO :"runtime_role";
GRANT UPDATE(status,starts_at,scheduled_end_at,end_requested_at,actual_ended_at,end_mode,ended_by_admin_id,finalized_at)
 ON simus.simulation_sessions TO :"runtime_role";
GRANT UPDATE(happiness,safety,cleanliness,version,updated_at) ON simus.city_states TO :"runtime_role";
GRANT UPDATE(pollution,updated_at) ON simus.region_states TO :"runtime_role";
GRANT UPDATE(x_score,y_score,response_count,updated_at) ON simus.participant_alignments TO :"runtime_role";
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA simus TO :"runtime_role";
COMMIT;
