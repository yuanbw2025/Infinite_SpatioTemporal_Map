import os
import json
import sys

# Append path to import chgis_compiler
sys.path.append(os.path.dirname(__file__))
from chgis_compiler import get_coordinates

def process_chuanxilu_data():
    base_dir = os.path.dirname(os.path.dirname(__file__))
    out_dir = os.path.join(base_dir, "TotalData", "ProcessedData")
    os.makedirs(os.path.join(out_dir, "annotated_md"), exist_ok=True)
    
    # 1. Write the annotated markdown
    annotated_text = """# 传习录 (摘录与关联图谱)

《传习录》是明代哲学家〖@名宦:王守仁〗（王阳明）的语录和信件集。

先生于弘治十二年（1499年）中进士，在〖=顺天府〗观政。正德元年（1506年），因上疏触怒刘瑾，谪贬至贵州〖=修文县〗（龙场驿）担任驿丞，在此期间首度开讲，提出“知行合一”，史称“龙场悟道”。此后，正德十一年（1516年），巡抚南赣，驻扎在〖=赣州府〗。嘉靖六年（1527年），起复前往广西平叛，驻节〖=南宁府〗。嘉靖七年（1528年），病逝于江西南安府〖=大余县〗（青龙铺）。

其中，徐爱、薛侃、钱德洪等人记录了先生在各地的讲学语录，终成此书。
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
                    "action": "谪贬龙场悟道"
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
    final_json_path = os.path.join(out_dir, "chuanxilu_extracted.json")
    with open(final_json_path, "w", encoding="utf-8") as f:
        json.dump({"meta": {"source": "传习录.epub (Multi-point Timeseries)"}, "data": raw_data}, f, ensure_ascii=False, indent=2)
        
    print(f"✅ Timeseries data generation complete. Saved to {final_json_path}")

if __name__ == "__main__":
    process_chuanxilu_data()
