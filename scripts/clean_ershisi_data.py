import json
import os

def clean_data():
    input_file = 'TotalData/ProcessedData/TOTAL_ERSHISI_STANDARD_DATA.json'
    output_file = 'TotalData/ProcessedData/TOTAL_ERSHISI_CLEAN_DATA.json'

    if not os.path.exists(input_file):
        print(f"Error: {input_file} not found.")
        return

    with open(input_file, 'r', encoding='utf-8') as f:
        raw_data = json.load(f)

    # 扩展黑名单，剔除更多噪音
    blacklist = {
        '不在诏内', '讨伐有罪', '官犯私罪', '男孩做火', '臣民言事', '待各方使', 
        '其言尤雅', '美尧之事', '求能治水', '有贤于鲧', '为人臣', '诸侯有畔', 
        '伐不听令', '商容贤', '要求。东汉', '相从，而不', '译过程历时', 
        '型，一是大事', '监修；天保', '始，至二十', '所以只用了',
        '殿中当临', '不在令中', '直言极谏', '丧事服临', '物之自然', '楚王计宜'
    }

    clean_graph = []
    for item in raw_data['graph']:
        # 深度过滤逻辑
        clean_times = [t for t in item['data']['times'] if len(t) > 2 and not any(noise in t for noise in blacklist)]
        clean_places = [p for p in item['data']['places'] if len(p) > 1 and not any(noise in p for noise in blacklist)]
        clean_persons = [n for n in item['data']['persons'] if len(n) >= 2 and n not in blacklist]
        
        # 只保留有意义的条目
        if clean_times or clean_places or clean_persons:
            clean_graph.append({
                'file': item['file'],
                'data': {
                    'times': list(set(clean_times)),
                    'places': list(set(clean_places)),
                    'persons': list(set(clean_persons))
                }
            })

    with open(output_file, 'w', encoding='utf-8') as out_f:
        json.dump({
            'status': 'Cleaned',
            'total_chapters_with_data': len(clean_graph),
            'graph': clean_graph
        }, out_f, ensure_ascii=False, indent=2)

    print(f"✨ 数据清洗完成！产出章节数: {len(clean_graph)}")

if __name__ == "__main__":
    clean_data()
