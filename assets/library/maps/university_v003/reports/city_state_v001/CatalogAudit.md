# Catalog final audit — 2026-10-14

이번 작업 전에 존재했던 manifest 오류 63건이 그대로 남아 있습니다. 누락된 기존 source/export 경로 62건과 기존 캐릭터 Blender 파일 해시 불일치 1건입니다. 이번 도시 상태 에셋에 새로 발생한 manifest 오류는 없습니다.

정상 catalog 명령은 기존 오류 때문에 inventory 저장을 거부합니다. 동일한 기존 오류 집합임을 확인한 후 해당 스크립트의 inventory() 생성기로 목록을 갱신했습니다. 파일 기록을 수작업으로 작성하지 않았습니다. 기존 자산 상태나 캐릭터 해시를 임의 승인하지 않았습니다.

Unity가 Blender 원본을 가져오며 생성한 maps/university_v003/Materials도 유효한 가져오기 산출물이므로 유지했습니다.

## 기존 오류

- candidate_building_plot_simus_building_plot_30x24: invalid or missing path assets/library/buildings/building_plot/source/SIMUS_Building_Plot_30x24.blend
- candidate_building_plot_simus_building_plot_30x24: invalid or missing path assets/library/buildings/building_plot/exports/SIMUS_Building_Plot_30x24.glb
- candidate_convenience_store_simus_convenience_store: invalid or missing path assets/library/buildings/convenience_store/source/SIMUS_Convenience_Store.blend
- candidate_convenience_store_simus_convenience_store: invalid or missing path assets/library/buildings/convenience_store/exports/SIMUS_Convenience_Store.glb
- candidate_department_store_simus_department_store: invalid or missing path assets/library/buildings/department_store/source/SIMUS_Department_Store.blend
- candidate_department_store_simus_department_store: invalid or missing path assets/library/buildings/department_store/exports/SIMUS_Department_Store.glb
- candidate_korean_guide_signs_simus_kguide_boundary: invalid or missing path assets/library/props/korean_guide_signs/source/SIMUS_Korean_Guide_Signs.blend
- candidate_korean_guide_signs_simus_kguide_boundary: invalid or missing path assets/library/props/korean_guide_signs/exports/SIMUS_KGuide_Boundary.glb
- candidate_korean_guide_signs_simus_kguide_direction: invalid or missing path assets/library/props/korean_guide_signs/source/SIMUS_Korean_Guide_Signs.blend
- candidate_korean_guide_signs_simus_kguide_direction: invalid or missing path assets/library/props/korean_guide_signs/exports/SIMUS_KGuide_Direction.glb
- candidate_korean_guide_signs_simus_kguide_distance: invalid or missing path assets/library/props/korean_guide_signs/source/SIMUS_Korean_Guide_Signs.blend
- candidate_korean_guide_signs_simus_kguide_distance: invalid or missing path assets/library/props/korean_guide_signs/exports/SIMUS_KGuide_Distance.glb
- candidate_korean_guide_signs_simus_kguide_gantry: invalid or missing path assets/library/props/korean_guide_signs/source/SIMUS_Korean_Guide_Signs.blend
- candidate_korean_guide_signs_simus_kguide_gantry: invalid or missing path assets/library/props/korean_guide_signs/exports/SIMUS_KGuide_Gantry.glb
- candidate_korean_guide_signs_simus_kguide_junction: invalid or missing path assets/library/props/korean_guide_signs/source/SIMUS_Korean_Guide_Signs.blend
- candidate_korean_guide_signs_simus_kguide_junction: invalid or missing path assets/library/props/korean_guide_signs/exports/SIMUS_KGuide_Junction.glb
- candidate_road_signs_simus_sign_crosswalk: invalid or missing path assets/library/props/road_signs/source/SIMUS_Sign_Crosswalk.blend
- candidate_road_signs_simus_sign_crosswalk: invalid or missing path assets/library/props/road_signs/exports/SIMUS_Sign_Crosswalk.glb
- candidate_road_signs_simus_sign_noentry: invalid or missing path assets/library/props/road_signs/source/SIMUS_Sign_NoEntry.blend
- candidate_road_signs_simus_sign_noentry: invalid or missing path assets/library/props/road_signs/exports/SIMUS_Sign_NoEntry.glb
- candidate_road_signs_simus_sign_oneway: invalid or missing path assets/library/props/road_signs/source/SIMUS_Sign_OneWay.blend
- candidate_road_signs_simus_sign_oneway: invalid or missing path assets/library/props/road_signs/exports/SIMUS_Sign_OneWay.glb
- candidate_road_signs_simus_sign_parking: invalid or missing path assets/library/props/road_signs/source/SIMUS_Sign_Parking.blend
- candidate_road_signs_simus_sign_parking: invalid or missing path assets/library/props/road_signs/exports/SIMUS_Sign_Parking.glb
- candidate_road_signs_simus_sign_speed30: invalid or missing path assets/library/props/road_signs/source/SIMUS_Sign_Speed30.blend
- candidate_road_signs_simus_sign_speed30: invalid or missing path assets/library/props/road_signs/exports/SIMUS_Sign_Speed30.glb
- candidate_road_signs_simus_sign_stop: invalid or missing path assets/library/props/road_signs/source/SIMUS_Sign_Stop.blend
- candidate_road_signs_simus_sign_stop: invalid or missing path assets/library/props/road_signs/exports/SIMUS_Sign_Stop.glb
- candidate_streetlight_simus_streetlight_6m: invalid or missing path assets/library/props/streetlight/source/SIMUS_Streetlight_6m.blend
- candidate_streetlight_simus_streetlight_6m: invalid or missing path assets/library/props/streetlight/exports/SIMUS_Streetlight_6m.glb
- candidate_traffic_light_simus_traffic_light_amber: invalid or missing path assets/library/props/traffic_light/source/SIMUS_Traffic_Light.blend
- candidate_traffic_light_simus_traffic_light_amber: invalid or missing path assets/library/props/traffic_light/exports/SIMUS_Traffic_Light_Amber.glb
- candidate_traffic_light_simus_traffic_light_green: invalid or missing path assets/library/props/traffic_light/source/SIMUS_Traffic_Light.blend
- candidate_traffic_light_simus_traffic_light_green: invalid or missing path assets/library/props/traffic_light/exports/SIMUS_Traffic_Light_Green.glb
- candidate_traffic_light_simus_traffic_light_red: invalid or missing path assets/library/props/traffic_light/source/SIMUS_Traffic_Light.blend
- candidate_traffic_light_simus_traffic_light_red: invalid or missing path assets/library/props/traffic_light/exports/SIMUS_Traffic_Light_Red.glb
- candidate_parking_lot_simus_parking_lot_16: invalid or missing path assets/library/roads/parking_lot/source/SIMUS_Parking_Lot_16.blend
- candidate_parking_lot_simus_parking_lot_16: invalid or missing path assets/library/roads/parking_lot/exports/SIMUS_Parking_Lot_16.glb
- candidate_road_corner_simus_road_corner_90: invalid or missing path assets/library/roads/road_corner/source/SIMUS_Road_Corner_90.blend
- candidate_road_corner_simus_road_corner_90: invalid or missing path assets/library/roads/road_corner/exports/SIMUS_Road_Corner_90.glb
- candidate_road_crossroad_simus_road_crossroad_15m: invalid or missing path assets/library/roads/road_crossroad/source/SIMUS_Road_Crossroad_15m.blend
- candidate_road_crossroad_simus_road_crossroad_15m: invalid or missing path assets/library/roads/road_crossroad/exports/SIMUS_Road_Crossroad_15m.glb
- candidate_road_straight_simus_road_straight_10m: invalid or missing path assets/library/roads/road_straight/source/SIMUS_Road_Straight_10m.blend
- candidate_road_straight_simus_road_straight_10m: invalid or missing path assets/library/roads/road_straight/exports/SIMUS_Road_Straight_10m.glb
- candidate_street_landscape_simus_bench: invalid or missing path assets/library/vegetation/street_landscape/source/SIMUS_Street_Landscape_Collection.blend
- candidate_street_landscape_simus_bench: invalid or missing path assets/library/vegetation/street_landscape/exports/SIMUS_Bench.glb
- candidate_street_landscape_simus_cherry: invalid or missing path assets/library/vegetation/street_landscape/source/SIMUS_Street_Landscape_Collection.blend
- candidate_street_landscape_simus_cherry: invalid or missing path assets/library/vegetation/street_landscape/exports/SIMUS_Cherry.glb
- candidate_street_landscape_simus_flowerbed: invalid or missing path assets/library/vegetation/street_landscape/source/SIMUS_Street_Landscape_Collection.blend
- candidate_street_landscape_simus_flowerbed: invalid or missing path assets/library/vegetation/street_landscape/exports/SIMUS_Flowerbed.glb
- candidate_street_landscape_simus_fringetree: invalid or missing path assets/library/vegetation/street_landscape/source/SIMUS_Street_Landscape_Collection.blend
- candidate_street_landscape_simus_fringetree: invalid or missing path assets/library/vegetation/street_landscape/exports/SIMUS_FringeTree.glb
- candidate_street_landscape_simus_ginkgo_autumn: invalid or missing path assets/library/vegetation/street_landscape/source/SIMUS_Street_Landscape_Collection.blend
- candidate_street_landscape_simus_ginkgo_autumn: invalid or missing path assets/library/vegetation/street_landscape/exports/SIMUS_Ginkgo_Autumn.glb
- candidate_street_landscape_simus_ginkgo_green: invalid or missing path assets/library/vegetation/street_landscape/source/SIMUS_Street_Landscape_Collection.blend
- candidate_street_landscape_simus_ginkgo_green: invalid or missing path assets/library/vegetation/street_landscape/exports/SIMUS_Ginkgo_Green.glb
- candidate_street_landscape_simus_metasequoia: invalid or missing path assets/library/vegetation/street_landscape/source/SIMUS_Street_Landscape_Collection.blend
- candidate_street_landscape_simus_metasequoia: invalid or missing path assets/library/vegetation/street_landscape/exports/SIMUS_Metasequoia.glb
- candidate_street_landscape_simus_trashbin: invalid or missing path assets/library/vegetation/street_landscape/source/SIMUS_Street_Landscape_Collection.blend
- candidate_street_landscape_simus_trashbin: invalid or missing path assets/library/vegetation/street_landscape/exports/SIMUS_TrashBin.glb
- candidate_street_landscape_simus_zelkova: invalid or missing path assets/library/vegetation/street_landscape/source/SIMUS_Street_Landscape_Collection.blend
- candidate_street_landscape_simus_zelkova: invalid or missing path assets/library/vegetation/street_landscape/exports/SIMUS_Zelkova.glb
- modular_character_happiness_animations_v001: hash mismatch unity/Assets/SIMUS/Art/characters/modular_hairfix_v001/models/SIMUS_Modular_Character_Happiness_Animations.blend
