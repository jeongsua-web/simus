-- Local prototype administrator identity; the HTTP key is generated in prototype/data.
-- Auth subject is metadata, not a password. Never expose the key or DB credentials to Unity.
INSERT INTO simus.admin_users(id,auth_subject,display_name)
VALUES('00000000-0000-0000-0000-000000000001','local-prototype-key','로컬 시제품 관리자')
ON CONFLICT (id) DO NOTHING;
