import os
import sys
import json
import re
from jsonschema import validate, ValidationError

sys.path.append(os.path.dirname(__file__))
from llm_client import call_llm

def extract_json_from_annotated(annotated_text: str, skill_path: str = "skills/02_json_extraction.md") -> list:
    """
    从标注好的文本中提炼严谨的 JSON 结构。
    """
    skill_full_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), skill_path)
    
    with open(skill_full_path, 'r', encoding='utf-8') as f:
        system_prompt = f.read()
        
    prompt = f"请以下列带标记的文本为基础，将其转化为业务要求的 JSON 对象数组：\n\n{annotated_text}\n\n记住：只输出 ```json 包裹的合法 JSON 字符串！"
    
    print("⏳ 正在调用大模型进行 JSON 提纯...")
    raw_json_output = call_llm(
        prompt=prompt,
        system_prompt=system_prompt,
        temperature=0.0
    )
    
    # 通过正则提取出 json 块
    match = re.search(r'```json\s*(.*?)\s*```', raw_json_output, re.DOTALL)
    if match:
        json_str = match.group(1)
    else:
        # 如果没有用代码块包裹，直接试着解析整个字符串
        json_str = raw_json_output
        
    try:
        data = json.loads(json_str)
        return data
    except json.JSONDecodeError as e:
        print(f"❌ JSON 解析失败：{e}\n原输出内容为：\n{raw_json_output}")
        return []

def lint_json_schema(data: list) -> bool:
    """
    校验产出的 JSON 是否符合必填要求。这里由于是 officials，暂时用内置的一个简易 schema
    如果是文博系统，可以去读 relics_schema.json
    """
    schema = {
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "entity_id": {"type": "string"},
                "name": {"type": "string"},
                "entity_type": {"type": "string", "enum": ["person", "region"]},
                "color": {"type": "array"},
                "events": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "time_desc": {"type": "string"},
                            "year": {"type": "integer"},
                            "location": {"type": "string"},
                            "action": {"type": "string"},
                            "lnglat": {"type": ["array", "null"]}
                        },
                        "required": ["time_desc", "year", "location", "action"]
                    }
                }
            },
            "required": ["entity_id", "name", "entity_type", "events"]
        }
    }
    try:
        validate(instance=data, schema=schema)
        print("✅ JSON Schema 校验通过。")
        return True
    except ValidationError as e:
        print(f"❌ JSON Schema 校验不通过：缺字段或格式错误 -> {e.message}")
        return False

if __name__ == "__main__":
    test_anno = "〖@名宦:向日紅〗向日紅，〖=湖北大冶〗人。恩選，〖§貢生〗，〖⌚明萬曆四年至十年〗任〖=清河〗〖§知縣〗，後升任〖=雲南〗〖§監察御史〗。"
    res = extract_json_from_annotated(test_anno)
    print("\n--- JSON 提纯结果 ---\n")
    print(json.dumps(res, indent=2, ensure_ascii=False))
    if res:
        lint_json_schema(res)
