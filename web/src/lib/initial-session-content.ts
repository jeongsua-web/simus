import type { PoolClient } from "pg";
import content from "./data/initial-session-content.json";
import { validateRules } from "./session-rules";
import { preparedLocation } from "./city-v002-event-mapping.mjs";

// Original text/scores/IDs remain unchanged. Only evidenced READY locations
// are authored into a newly created v002 DRAFT, never an existing session.
export const initialRules = validateRules({
  version: 1,
  alignment_thresholds: { negative: -3, positive: 3 },
  alignment_axes: { x: { negative: "CHAOTIC", positive: "LAWFUL" }, y: { negative: "EVIL", positive: "GOOD" } },
  interpretations: {
    LAWFUL_GOOD: "질서 선", LAWFUL_NEUTRAL: "질서 중립", LAWFUL_EVIL: "질서 악",
    NEUTRAL_GOOD: "중립 선", TRUE_NEUTRAL: "완전 중립", NEUTRAL_EVIL: "중립 악",
    CHAOTIC_GOOD: "혼돈 선", CHAOTIC_NEUTRAL: "혼돈 중립", CHAOTIC_EVIL: "혼돈 악",
  },
  initial_city_state: { happiness: 50, safety: 50, cleanliness: 50 },
  initial_region_pollution: { EXHIBITION_CITY: 0 },
  zero_response_policy: "EXCLUDE", completion_policy: "DRAIN",
}, ["EXHIBITION_CITY"]);

const regionId = "26000000-0000-0000-0000-000000000001";
const contentId = (group: number, number: number) => `${group}0000000-0000-0000-0000-${String(number).padStart(12, "0")}`;

export async function insertInitialContent(db: PoolClient, sessionId: string) {
  await db.query(`INSERT INTO simus.session_regions(session_id,id,code,name,aggregation_weight,map_metadata)
    VALUES($1,$2,'EXHIBITION_CITY','전시 도시 전체',1,'{"placement":"pending-map-v1"}')`, [sessionId, regionId]);
  for (const situation of content.situations) {
    const situationId = contentId(3, situation.number);
    await db.query(`INSERT INTO simus.session_situations(session_id,id,code,title,body,display_order,event_location,is_generic)
      VALUES($1,$2,$3,$4,$4,$5,$6,false)`,
    [sessionId, situationId, `EXHIBITION_${String(situation.number).padStart(2, "0")}`, situation.title, situation.number,
      preparedLocation(`EXHIBITION_${String(situation.number).padStart(2, "0")}`)]);
    for (const choice of situation.choices) {
      const choiceId = contentId(4, situation.number * 10 + choice.number);
      const s = choice.scores;
      await db.query(`INSERT INTO simus.session_choices(session_id,situation_id,id,label,display_order,importance,
        alignment_dx,alignment_dy,happiness_base,safety_base,cleanliness_base)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [sessionId, situationId, choiceId, choice.label, choice.number,
        Math.max(Math.abs(s.order), Math.abs(s.morality)) > 1 ? "MAJOR" : "NORMAL",
        s.order, s.morality, s.happiness, s.safety, s.cleanliness]);
      await db.query(`INSERT INTO simus.choice_region_effects(session_id,situation_id,choice_id,region_id,pollution_base)
        VALUES($1,$2,$3,$4,$5)`, [sessionId, situationId, choiceId, regionId, s.pollution]);
    }
  }
}
