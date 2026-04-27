import os
import sys

def extract_text(input_path, output_path):
    ext = os.path.splitext(input_path)[-1].lower()
    
    try:
        if ext == '.txt':
            with open(input_path, 'r', encoding='utf-8', errors='ignore') as f:
                text = f.read()
        elif ext == '.pdf':
            import fitz
            doc = fitz.open(input_path)
            text = "\n".join([page.get_text() for page in doc])
        elif ext == '.epub':
            import zipfile, re
            text_content = []
            with zipfile.ZipFile(input_path, 'r') as z:
                for filename in z.namelist():
                    if filename.endswith('.html') or filename.endswith('.htm') or filename.endswith('.xhtml'):
                        content = z.read(filename).decode('utf-8', errors='ignore')
                        clean_text = re.sub('<[^<]+>', '\n', content)
                        clean_text = '\n'.join([line.strip() for line in clean_text.split('\n') if line.strip()])
                        text_content.append(clean_text)
            text = '\n'.join(text_content)
        elif ext == '.mobi':
            import mobi
            import re
            tempdir, filepath = mobi.extract(input_path)
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                clean_text = re.sub('<[^<]+>', '\n', content)
                text = '\n'.join([line.strip() for line in clean_text.split('\n') if line.strip()])
        elif ext == '.rtf':
            from striprtf.striprtf import rtf_to_text
            with open(input_path, 'r', encoding='utf-8', errors='ignore') as f:
                text = rtf_to_text(f.read())
        elif ext == '.fb2':
            import xml.etree.ElementTree as ET
            tree = ET.parse(input_path)
            root = tree.getroot()
            # Handle FB2 namespace
            namespaces = {'fb': 'http://www.gribuser.ru/xml/fictionbook/2.0'}
            paragraphs = root.findall('.//fb:p', namespaces)
            if not paragraphs:
                paragraphs = root.findall('.//p')
            text = '\n'.join([p.text for p in paragraphs if p.text])
        else:
            print(f"❌ 未知格式: {ext}")
            return False

        if not text.strip():
            print(f"⚠️ 警告: 从 {ext} 中提取到了 0 个字符。")
            
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(text)
        print(f"✅ 万能解析器成功处理 {ext} 文件，提取纯文本 {len(text)} 字符 -> {output_path}")
        return True

    except Exception as e:
        print(f"❌ 解析 {ext} 失败: {e}")
        return False

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python universal_extractor.py <input_file> <output_txt>")
        sys.exit(1)
    extract_text(sys.argv[1], sys.argv[2])
