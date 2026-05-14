#!/usr/bin/env python3
"""
build_xiangyu_map_data.py
从项羽本纪标注数据提取地名，匹配CHGIS + 手工字典，
裁剪Natural Earth河流/海岸线到中国区域，
输出前端可用的JSON文件。
"""
import json, os, re, shapefile
from collections import OrderedDict

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GIS_DIR = os.path.join(BASE, "TotalData", "GISData")
OUT_DIR = os.path.join(BASE, "app", "public", "data")

# ── 1. 手工坐标字典（秦末楚汉地名，CHGIS大概率查不到的） ──
# 来源：谭其骧《中国历史地图集》第二册 + 历史地理学研究
MANUAL_COORDS = {
    # 核心战场/关隘
    "下相": [118.30, 33.96],    # 今江苏宿迁
    "项": [116.06, 33.47],      # 今河南沈丘
    "吴中": [120.62, 31.30],    # 今江苏苏州
    "会稽": [120.58, 30.00],    # 今浙江绍兴
    "大泽中": [117.10, 33.75],  # 大泽乡，今安徽宿州
    "广陵": [119.43, 32.39],    # 今江苏扬州
    "东阳": [118.85, 32.93],    # 今安徽天长
    "下邳": [117.95, 34.31],    # 今江苏邳州
    "彭城": [117.19, 34.26],    # 今江苏徐州
    "胡陵": [116.60, 34.95],    # 今山东鱼台
    "薛": [117.13, 34.88],      # 今山东滕州
    "襄城": [113.48, 33.85],    # 今河南襄城
    "沛": [116.93, 34.73],      # 今江苏沛县
    "居鄛": [117.38, 31.45],    # 今安徽巢湖
    "盱台": [118.54, 33.01],    # 今江苏盱眙
    "亢父": [116.98, 35.38],    # 今山东济宁
    "东阿": [116.25, 36.33],    # 今山东东阿
    "城阳": [118.31, 35.58],    # 今山东莒县
    "濮阳": [115.03, 35.76],    # 今河南濮阳
    "定陶": [115.57, 35.07],    # 今山东定陶
    "雍丘": [114.77, 34.52],    # 今河南杞县
    "外黄": [115.02, 34.67],    # 今河南民权
    "陈留": [114.80, 34.38],    # 今河南开封
    "砀": [116.35, 34.43],      # 今安徽砀山
    "巨鹿": [115.18, 37.22],    # 今河北平乡
    "棘原": [114.35, 36.38],    # 今河北武安
    "咸阳": [108.72, 34.33],    # 今陕西咸阳
    "新安": [111.72, 34.73],    # 今河南新安（坑秦卒）
    "殷虚": [114.30, 36.12],    # 今河南安阳
    "函谷关": [110.87, 34.52],  # 今河南灵宝
    "戏西": [109.20, 34.38],    # 今陕西临潼
    "霸上": [109.05, 34.20],    # 今西安东
    "鸿门": [109.22, 34.35],    # 今临潼新丰
    "新丰": [109.25, 34.38],    # 今陕西临潼
    "关中": [108.90, 34.26],    # 泛指关中地区
    "山东": [116.00, 35.00],    # 泛指崤山以东
    "郦山": [109.10, 34.36],    # 骊山
    "芷阳": [109.10, 34.28],    # 今西安灞桥
    "废丘": [108.40, 34.33],    # 今陕西兴平
    "栎阳": [109.22, 34.67],    # 今陕西阎良
    "高奴": [109.49, 36.60],    # 今陕西延安
    "上郡": [109.95, 38.28],    # 今陕西绥德
    "平阳": [111.67, 36.10],    # 今山西临汾
    "河东": [110.99, 34.83],    # 今山西运城
    "雒阳": [112.45, 34.62],    # 洛阳
    "阳翟": [113.55, 34.15],    # 今河南禹州
    "河内": [113.25, 35.08],    # 今河南沁阳
    "朝歌": [114.20, 35.62],    # 今河南淇县
    "襄国": [114.50, 37.05],    # 今河北邢台
    "六": [116.78, 31.75],      # 今安徽六安
    "邾": [114.88, 30.38],      # 今湖北武汉黄陂
    "江陵": [112.19, 30.33],    # 今湖北荆州
    "南郡": [112.19, 30.33],    # 同江陵
    "蓟": [116.40, 39.90],      # 今北京
    "临菑": [118.31, 36.88],    # 今山东淄博
    "博阳": [117.12, 36.20],    # 今山东泰安
    "南皮": [116.70, 38.03],    # 今河北南皮
    "安阳": [114.35, 36.10],    # 今河南安阳
    "无盐": [116.30, 35.80],    # 今山东东平
    "三户": [113.78, 36.28],    # 漳水三户津
    "荥阳": [113.38, 34.78],    # 今河南荥阳
    "成皋": [113.23, 34.75],    # 今河南巩义
    "广武": [113.35, 34.82],    # 今河南荥阳广武山
    "敖仓": [113.40, 34.80],    # 荥阳附近粮仓
    "鸿沟": [113.50, 34.75],    # 古运河
    "巴": [106.57, 29.56],      # 今重庆
    "蜀": [104.07, 30.67],      # 今成都
    "汉中": [107.02, 33.07],    # 今陕西汉中
    "南郑": [106.94, 33.07],    # 今陕西南郑
    "三秦": [108.90, 34.26],    # 泛指关中
    "垓下": [117.10, 33.35],    # 今安徽灵璧（核心战场！）
    "阴陵": [117.55, 33.08],    # 今安徽定远
    "东城": [118.02, 32.30],    # 今安徽滁州
    "乌江": [118.38, 31.57],    # 今安徽和县乌江镇
    "瑕丘": [116.78, 35.55],    # 今山东兖州
    "胶东": [121.00, 37.10],    # 泛指山东半岛
    "即墨": [120.45, 36.38],    # 今山东即墨
    "梁地": [115.65, 34.45],    # 梁国，今商丘附近
    "代": [114.47, 39.37],      # 今河北蔚县
    "常山": [114.50, 38.05],    # 今河北正定
    "九江": [116.00, 30.50],    # 泛指今安徽一带
    "辽东": [123.18, 41.27],    # 今辽宁辽阳
    "济北": [116.97, 36.65],    # 今山东济南长清
    "长沙": [112.97, 28.23],    # 今湖南长沙
    "郴县": [113.03, 25.77],    # 今湖南郴州
    "无终": [117.60, 39.88],    # 今天津蓟州
    "戏下": [109.20, 34.38],    # 同戏西
    "阳夏": [114.88, 33.78],    # 今河南太康
    "固陵": [114.88, 33.73],    # 今河南太康
    "寿春": [116.50, 32.00],    # 今安徽寿县
    "城父": [115.98, 33.63],    # 今安徽亳州
    "舒": [117.05, 31.00],      # 今安徽庐江
    "睢阳": [115.65, 34.45],    # 今河南商丘
    "谷城": [115.95, 35.97],    # 今山东东阿
    "修武": [113.45, 35.22],    # 今河南修武
    "宛": [112.53, 33.00],      # 今河南南阳
    "叶": [113.35, 33.62],      # 今河南叶县
    "巩": [113.02, 34.75],      # 今河南巩义
    "下邑": [116.08, 34.27],    # 今安徽砀山
    "灵壁": [117.55, 33.55],    # 今安徽灵璧
    "萧": [116.95, 34.19],      # 今安徽萧县
    "鲁": [117.00, 35.60],      # 今山东曲阜
    "中水": [116.43, 38.23],    # 今河北献县
    "杜衍": [112.37, 35.12],    # 今河南安阳
    "赤泉": [113.22, 34.77],    # 今河南荥阳
    "吴防": [116.78, 31.03],    # 今安徽无为
    "涅阳": [112.15, 33.22],    # 今河南邓州
    "北海": [118.77, 36.78],    # 今山东潍坊
    "平原": [116.43, 37.17],    # 今山东平原
    "陈": [114.88, 33.73],      # 今河南淮阳
    "鄢郢": [112.20, 30.33],    # 同江陵
    "马服": [114.47, 36.40],    # 今河北邯郸
    "榆中": [104.10, 35.85],    # 今甘肃兰州
    "阳周": [109.37, 36.78],    # 今陕西子长
    "蕲": [117.00, 33.50],      # 今安徽宿州蕲县
    "秦中": [108.90, 34.26],    # 同关中
    "秦地": [108.90, 34.26],    # 同关中
    "楚地": [117.19, 34.26],    # 泛指楚地
    "楚国": [117.19, 34.26],    # 同
    "楚": [117.19, 34.26],      # 同
    "秦": [108.90, 34.26],      # 同关中
    "赵": [114.50, 37.05],      # 赵国，今邢台
    "齐": [118.31, 36.88],      # 齐国，今淄博
    "汉": [107.02, 33.07],      # 汉国，同汉中
    "韩": [113.55, 34.15],      # 韩国，同阳翟
    "江东": [120.00, 31.50],    # 泛指长江下游
    "河北": [114.50, 37.00],    # 古义黄河以北
    "河南": [113.00, 34.50],    # 古义黄河以南
    "江西": [116.00, 33.00],    # 古义长江以西
    "司马门": [108.72, 34.33],  # 咸阳宫门
    "梁": [115.65, 34.45],      # 同梁地
    "东海": [119.18, 34.75],    # 今江苏连云港
    "盱台": [118.54, 33.01],    # 今江苏盱眙
    "赵地": [114.50, 37.05],    # 同赵
    "栗": [115.78, 34.08],      # 今河南夏邑
}

# ── 2. 加载 CHGIS ──
def load_chgis():
    """返回 {name: [lng, lat]} 字典"""
    result = {}
    for subdir, fname in [
        ("v6_time_pref_pts_utf_wgs84", "v6_time_pref_pts_utf_wgs84.shp"),
        ("v6_time_cnty_pts_utf_wgs84", "v6_time_cnty_pts_utf_wgs84.shp"),
    ]:
        shp_path = os.path.join(GIS_DIR, subdir, fname)
        if not os.path.exists(shp_path):
            print(f"⚠️  未找到 {shp_path}")
            continue
        sf = shapefile.Reader(shp_path)
        for rec in sf.records():
            name = rec.NAME_CH
            if name and name not in result:
                result[name] = [rec.X_COOR, rec.Y_COOR]
    print(f"✅ CHGIS 加载完成: {len(result)} 条")
    return result

# ── 3. 从标注数据提取地名 ──
def extract_locations(json_path):
    """提取所有 <loc> 标签内的地名"""
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    loc_set = OrderedDict()
    loc_pattern = re.compile(r'<loc>(.*?)</loc>')
    
    # 也提取 <geo> 标签（河流/山脉）
    geo_pattern = re.compile(r'<geo>(.*?)</geo>')
    
    for para in data['paragraphs']:
        ann = para.get('annotated', '')
        if not ann:
            continue
        for m in loc_pattern.finditer(ann):
            name = m.group(1)
            if name not in loc_set:
                loc_set[name] = []
            loc_set[name].append(para['pid'])
        for m in geo_pattern.finditer(ann):
            name = m.group(1)
            if name not in loc_set:
                loc_set[name] = []
            loc_set[name].append(para['pid'])
    
    return loc_set

# ── 4. 匹配坐标 ──
def resolve_coordinates(loc_dict, chgis, manual):
    """尝试匹配每个地名的坐标"""
    results = []
    matched = 0
    missed = []
    
    for name, pids in loc_dict.items():
        coord = None
        source = None
        
        # 优先手工字典
        if name in manual:
            coord = manual[name]
            source = "manual"
        # CHGIS 精确匹配
        elif name in chgis:
            coord = chgis[name]
            source = "chgis_exact"
        else:
            # CHGIS 模糊匹配（加后缀）
            for suffix in ['府', '县', '州', '厅', '路', '郡']:
                if name + suffix in chgis:
                    coord = chgis[name + suffix]
                    source = "chgis_fuzzy"
                    break
                if name.endswith(suffix) and name[:-1] in chgis:
                    coord = chgis[name[:-1]]
                    source = "chgis_fuzzy"
                    break
        
        if coord:
            matched += 1
            results.append({
                "name": name,
                "lng": round(coord[0], 4),
                "lat": round(coord[1], 4),
                "source": source,
                "pids": pids
            })
        else:
            missed.append(name)
    
    return results, matched, missed

# ── 5. 裁剪 Natural Earth 到中国区域 GeoJSON ──
def shp_to_china_geojson(shp_path, bbox=(70, 15, 140, 55)):
    """将shapefile裁剪到中国区域，输出GeoJSON features"""
    sf = shapefile.Reader(shp_path)
    features = []
    min_lng, min_lat, max_lng, max_lat = bbox
    
    for shape_rec in sf.shapeRecords():
        geom = shape_rec.shape
        props = {}
        try:
            props["name"] = shape_rec.record.name if hasattr(shape_rec.record, 'name') else ""
        except:
            props["name"] = ""
        
        # 检查是否在中国区域范围内
        if geom.shapeType in (3, 13):  # Polyline / PolylineZ
            filtered_parts = []
            for part_idx in range(len(geom.parts)):
                start = geom.parts[part_idx]
                end = geom.parts[part_idx + 1] if part_idx + 1 < len(geom.parts) else len(geom.points)
                points = geom.points[start:end]
                # 检查线段是否有任何点在bbox内
                in_bbox = any(min_lng <= p[0] <= max_lng and min_lat <= p[1] <= max_lat for p in points)
                if in_bbox:
                    filtered_parts.append([[round(p[0], 4), round(p[1], 4)] for p in points])
            
            if filtered_parts:
                if len(filtered_parts) == 1:
                    features.append({
                        "type": "Feature",
                        "properties": props,
                        "geometry": {
                            "type": "LineString",
                            "coordinates": filtered_parts[0]
                        }
                    })
                else:
                    features.append({
                        "type": "Feature",
                        "properties": props,
                        "geometry": {
                            "type": "MultiLineString",
                            "coordinates": filtered_parts
                        }
                    })
    
    return {
        "type": "FeatureCollection",
        "features": features
    }


def main():
    print("=" * 60)
    print("🗺️  项羽本纪地图数据构建")
    print("=" * 60)
    
    # Step 1: 加载 CHGIS
    chgis = load_chgis()
    
    # Step 2: 提取地名
    json_path = os.path.join(OUT_DIR, "xiangyu_annotated.json")
    loc_dict = extract_locations(json_path)
    print(f"✅ 提取地名: {len(loc_dict)} 个独立地名")
    
    # Step 3: 匹配坐标
    results, matched, missed = resolve_coordinates(loc_dict, chgis, MANUAL_COORDS)
    print(f"✅ 匹配成功: {matched}/{len(loc_dict)} ({100*matched//len(loc_dict)}%)")
    if missed:
        print(f"⚠️  未匹配 ({len(missed)}): {missed}")
    
    # Step 4: 输出 xiangyu_locations.json
    output = {
        "chapter": "项羽本纪",
        "era": "秦末楚汉 (前209-前202)",
        "center": [113.5, 34.5],
        "zoom": 5,
        "locations": results
    }
    out_path = os.path.join(OUT_DIR, "xiangyu_locations.json")
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(f"✅ 输出: {out_path} ({len(results)} 个地点)")
    
    # Step 5: 裁剪 Natural Earth 河流
    rivers_shp = os.path.join(GIS_DIR, "ne_rivers", "ne_10m_rivers_lake_centerlines.shp")
    if os.path.exists(rivers_shp):
        rivers_geojson = shp_to_china_geojson(rivers_shp)
        rivers_out = os.path.join(OUT_DIR, "china_rivers.json")
        with open(rivers_out, 'w', encoding='utf-8') as f:
            json.dump(rivers_geojson, f)
        print(f"✅ 河流: {rivers_out} ({len(rivers_geojson['features'])} 条)")
    
    # Step 6: 裁剪 Natural Earth 海岸线
    coast_shp = os.path.join(GIS_DIR, "ne_coastline", "ne_10m_coastline.shp")
    if os.path.exists(coast_shp):
        coast_geojson = shp_to_china_geojson(coast_shp)
        coast_out = os.path.join(OUT_DIR, "china_coastline.json")
        with open(coast_out, 'w', encoding='utf-8') as f:
            json.dump(coast_geojson, f)
        print(f"✅ 海岸线: {coast_out} ({len(coast_geojson['features'])} 条)")
    
    print("=" * 60)
    print("🎉 全部完成！")


if __name__ == "__main__":
    main()
