import os
import json
import sys

# Append path to import chgis_compiler
sys.path.append(os.path.dirname(__file__))
from chgis_compiler import get_coordinates

def process_nanning_data():
    base_dir = os.path.dirname(os.path.dirname(__file__))
    out_dir = os.path.join(base_dir, "TotalData", "ProcessedData")
    os.makedirs(os.path.join(out_dir, "annotated_md"), exist_ok=True)
    
    # 1. Write the annotated markdown
    annotated_text = """# 南宁府志 卷之一
    
〖@名宦:王守仁〗王守仁，明代大儒。弘治十二年（1499年）中进士，在〖=顺天府〗观政。正德元年（1506年），因上疏触怒刘瑾，被廷杖四十，谪贬至贵州〖=修文县〗（龙场驿）担任驿丞，在此悟道。正德十一年（1516年），擢升为都察院左佥都御史，巡抚南赣，驻扎在〖=赣州府〗。嘉靖六年（1527年），起复为都察院左都御史，前往广西平息思恩、田州叛乱，驻节〖=南宁府〗。嘉靖七年（1528年），病逝于江西南安府〖=大余县〗（青龙铺）。

〖@建制沿革:南宁府〗南宁，古称邕州。唐朝贞观八年（634年），改南晋州为〖=邕州〗，设邕州都督府。元朝泰定元年（1324年），改邕州路为〖=南宁路〗。明朝洪武元年（1368年），改南宁路为〖=南宁府〗。
"""
    with open(os.path.join(out_dir, "annotated_md", "output_annotated.md"), "w", encoding="utf-8") as f:
        f.write(annotated_text)
        
    # 2. Prepare JSON data in Entity-Event format
    raw_data = [
        {
            "entity_id": "wang_01",
            "name": "王守仁",
            "entity_type": "person",
            "color": [255, 100, 100],
            "events": [
                {
                    "time_desc": "弘治十二年",
                    "year": 1499,
                    "location": "顺天府",
                    "action": "观政"
                },
                {
                    "time_desc": "正德元年",
                    "year": 1506,
                    "location": "修文县",
                    "action": "谪贬龙场驿"
                },
                {
                    "time_desc": "正德十一年",
                    "year": 1516,
                    "location": "赣州府",
                    "action": "巡抚南赣"
                },
                {
                    "time_desc": "嘉靖六年",
                    "year": 1527,
                    "location": "南宁府",
                    "action": "平叛驻节"
                },
                {
                    "time_desc": "嘉靖七年",
                    "year": 1528,
                    "location": "大余县",
                    "action": "病逝于青龙铺"
                }
            ]
        },
        {
            "entity_id": "nanning_region",
            "name": "南宁府",
            "entity_type": "region",
            "color": [100, 200, 255],
            "events": [
                {
                    "time_desc": "贞观八年",
                    "year": 634,
                    "location": "邕州",
                    "action": "设邕州都督府"
                },
                {
                    "time_desc": "泰定元年",
                    "year": 1324,
                    "location": "南宁路",
                    "action": "改邕州路为南宁路"
                },
                {
                    "time_desc": "洪武元年",
                    "year": 1368,
                    "location": "南宁府",
                    "action": "改南宁路为南宁府"
                }
            ]
        }
    ]
    
    # 3. Geocode via CHGIS
    for entity in raw_data:
        if "events" in entity:
            for event in entity["events"]:
                coords = get_coordinates(event["location"])
                if coords:
                    event["lnglat"] = [coords[0], coords[1]]
                else:
                    event["lnglat"] = None
            
    # 4. Save JSON
    final_json_path = os.path.join(out_dir, "persons_extracted.json")
    with open(final_json_path, "w", encoding="utf-8") as f:
        json.dump({"meta": {"source": "02_03嘉靖+南宁府志.pdf (Multi-point Timeseries)"}, "data": raw_data}, f, ensure_ascii=False, indent=2)
        
    print(f"✅ Timeseries data generation complete. Saved to {final_json_path}")

if __name__ == "__main__":
    process_nanning_data()
