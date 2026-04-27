import os
import sys
import argparse
import json
from universal_extractor import extract_text
from text_annotator import annotate_text
from lint_integrity import verify_zero_tampering
from entity_to_json import extract_json_from_annotated, lint_json_schema

def run_pipeline(input_file: str, output_dir: str):
    print(f"🚀 初始化无限细化数据管线...")
    print(f"📁 输入文件: {input_file}")
    
    # 0. 全能文件解析 (支持 PDF, EPUB, TXT, MOBI, RTF, FB2)
    tmp_txt_path = os.path.join(output_dir, "temp_extracted.txt")
    success = extract_text(input_file, tmp_txt_path)
    if not success:
        return
    target_text_file = tmp_txt_path

    with open(target_text_file, 'r', encoding='utf-8') as f:
        original_text = f.read()

    if not original_text.strip():
        print("❌ 输入文本为空。")
        return

    # 1. 实体标注
    print("\n================ [Step 1: Entity Annotation] ================")
    annotated_text = annotate_text(original_text)
    
    # 保存打标后的文本（存档）
    annotated_md_path = os.path.join(output_dir, "annotated_md", "output_annotated.md")
    os.makedirs(os.path.dirname(annotated_md_path), exist_ok=True)
    with open(annotated_md_path, 'w', encoding='utf-8') as f:
        f.write(annotated_text)
    print(f"💾 标注中间态已保存至: {annotated_md_path}")

    # 2. 完整性门禁校验
    print("\n================ [Step 2: Integrity Linting] ================")
    is_pure = verify_zero_tampering(original_text, annotated_text)
    if not is_pure:
        print("🚨 [FATAL] AI 篡改了原文！门禁系统拦截。将终止入库流程。")
        sys.exit(1)
    else:
        print("✅ [Lint Passed] 字符完整率 100%。允许放行。")

    # 3. JSON 提纯
    print("\n================ [Step 3: JSON Extraction] ================")
    json_data = extract_json_from_annotated(annotated_text)
    
    # 3.5 CHGIS 坐标挂载 (Phase 2)
    print("\n================ [Step 3.5: Geocoding via CHGIS] ================")
    try:
        from chgis_compiler import get_coordinates
        mapped_count = 0
        total_events = 0
        for entity in json_data:
            if "events" in entity:
                for event in entity["events"]:
                    total_events += 1
                    if "location" in event and event["location"]:
                        coords = get_coordinates(event["location"])
                        if coords:
                            event["lnglat"] = [coords[0], coords[1]]
                            mapped_count += 1
                        else:
                            event["lnglat"] = None
        print(f"🌍 成功为 {mapped_count}/{total_events} 个历史事件挂载精准 GPS 坐标！")
    except ImportError:
        print("⚠️ chgis_compiler 模块未找到，跳过坐标挂载。")
    
    # 4. JSON Schema 校验
    print("\n================ [Step 4: Schema Validation] ================")
    if not lint_json_schema(json_data):
        print("⚠️ 架构校验存在警告，请检查提纯结果。")
        
    # 保存最终 JSON 
    final_json_path = os.path.join(output_dir, "persons_extracted.json")
    with open(final_json_path, 'w', encoding='utf-8') as f:
        json.dump({"meta": {"source": input_file}, "officials": json_data}, f, ensure_ascii=False, indent=2)
        
    print(f"🎉 管线执行完毕！")
    print(f"   最终成品 JSON 输出至: {final_json_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Infinite SpatioTemporal Map Data Pipeline")
    parser.add_argument("input", help="输入文件路径，支持 .txt 或 .pdf")
    parser.add_argument("--outdir", default="TotalData/ProcessedData", help="输出根目录")
    
    args = parser.parse_args()
    
    # 获取绝对路径，方便到处执行
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    input_path = os.path.join(base_dir, args.input) if not os.path.isabs(args.input) else args.input
    out_dir = os.path.join(base_dir, args.outdir) if not os.path.isabs(args.outdir) else args.outdir
    
    if not os.path.exists(input_path):
        print(f"❌ 找不到输入文件：{input_path}")
        sys.exit(1)
        
    # 临时配置环境变量模拟 MOCK 走通全量流程
    os.environ.setdefault("MOCK_LLM", "true") 
    
    run_pipeline(input_path, out_dir)
