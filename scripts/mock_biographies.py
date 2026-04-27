import os
import json
import sys

# Append path to import chgis_compiler
sys.path.append(os.path.dirname(__file__))
from chgis_compiler import get_coordinates

def process_biographies_data():
    base_dir = os.path.dirname(os.path.dirname(__file__))
    out_dir = os.path.join(base_dir, "TotalData", "ProcessedData")
    os.makedirs(out_dir, exist_ok=True)
    
    # 2. Prepare JSON data in Entity-Event format (with Month granularity)
    raw_data = [
        {
            "entity_id": "wang_01",
            "name": "王守仁",
            "entity_type": "person",
            "color": [255, 100, 100],
            "events": [
                {
                    "time_desc": "成化八年九月",
                    "year": 1472,
                    "month": 9,
                    "location": "余姚",
                    "action": "出生"
                },
                {
                    "time_desc": "弘治十二年三月",
                    "year": 1499,
                    "month": 3,
                    "location": "顺天府",
                    "action": "中进士，观政"
                },
                {
                    "time_desc": "正德元年三月",
                    "year": 1506,
                    "month": 3,
                    "location": "修文县",
                    "action": "谪贬龙场悟道"
                },
                {
                    "time_desc": "正德十一年九月",
                    "year": 1516,
                    "month": 9,
                    "location": "赣州府",
                    "action": "巡抚南赣"
                },
                {
                    "time_desc": "正德十四年六月",
                    "year": 1519,
                    "month": 6,
                    "location": "南昌府",
                    "action": "平定宁王之乱"
                },
                {
                    "time_desc": "嘉靖六年五月",
                    "year": 1527,
                    "month": 5,
                    "location": "南宁府",
                    "action": "平叛驻节"
                },
                {
                    "time_desc": "嘉靖七年十一月",
                    "year": 1528,
                    "month": 11,
                    "location": "大余县",
                    "action": "病逝于青龙铺"
                }
            ]
        },
        {
            "entity_id": "zhang_01",
            "name": "张居正",
            "entity_type": "person",
            "color": [100, 255, 150],
            "events": [
                {
                    "time_desc": "嘉靖四年四月",
                    "year": 1525,
                    "month": 4,
                    "location": "江陵县",
                    "action": "出生"
                },
                {
                    "time_desc": "嘉靖二十六年三月",
                    "year": 1547,
                    "month": 3,
                    "location": "顺天府",
                    "action": "中进士，入翰林院"
                },
                {
                    "time_desc": "隆庆元年二月",
                    "year": 1567,
                    "month": 2,
                    "location": "顺天府",
                    "action": "任吏部左侍郎兼东阁大学士"
                },
                {
                    "time_desc": "万历元年六月",
                    "year": 1573,
                    "month": 6,
                    "location": "顺天府",
                    "action": "推行考成法"
                },
                {
                    "time_desc": "万历五年九月",
                    "year": 1577,
                    "month": 9,
                    "location": "江陵县",
                    "action": "丁忧夺情事件"
                },
                {
                    "time_desc": "万历九年正月",
                    "year": 1581,
                    "month": 1,
                    "location": "顺天府",
                    "action": "推行一条鞭法"
                },
                {
                    "time_desc": "万历十年六月",
                    "year": 1582,
                    "month": 6,
                    "location": "顺天府",
                    "action": "病逝"
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
    final_json_path = os.path.join(out_dir, "biographies_extracted.json")
    with open(final_json_path, "w", encoding="utf-8") as f:
        json.dump({"meta": {"source": "双传记联合解析 (Month-level Granularity)"}, "data": raw_data}, f, ensure_ascii=False, indent=2)
        
    print(f"✅ Biographies data generation complete. Saved to {final_json_path}")

if __name__ == "__main__":
    process_biographies_data()
