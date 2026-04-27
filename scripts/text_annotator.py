import os
import sys

# Ensure the scripts dir is in path to import siblings
sys.path.append(os.path.dirname(__file__))
from llm_client import call_llm

def annotate_text(raw_text: str, skill_path: str = "skills/01_entity_annotation.md") -> str:
    """
    读取输入的纯文本，根据技能文档构建 prompt，调用大模型进行实体标记。
    """
    skill_full_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), skill_path)
    
    with open(skill_full_path, 'r', encoding='utf-8') as f:
        system_prompt = f.read()
        
    prompt = f"请严格遵守刚才设定的实体标注规范，在不改变原文字符的情况下，对以下文本片段加上〖符号〗标记：\n\n```text\n{raw_text}\n```\n\n只返回标记后的文本内容，不要输出其他废话。"
    
    print("⏳ 正在调用大模型进行实体打标...")
    annotated_md = call_llm(
        prompt=prompt,
        system_prompt=system_prompt,
        temperature=0.1 # 实体抽取应尽可能严谨确定
    )
    
    # 简单的后处理，去掉可能被 LLM 加上去的 ```markdown 等代码块包裹
    annotated_md = annotated_md.replace("```markdown", "").replace("```text", "").replace("```", "").strip()
    return annotated_md

if __name__ == "__main__":
    test_txt = "向日紅，湖北大冶人。恩選，貢生，明萬曆四年至十年任清河知縣，後升任雲南監察御史。"
    res = annotate_text(test_txt)
    print("\n--- 标注结果 ---\n")
    print(res)
