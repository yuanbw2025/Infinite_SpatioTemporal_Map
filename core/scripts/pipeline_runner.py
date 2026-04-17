import os
import sys
import json
import logging

# Configure Logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

class DataPipeline:
    def __init__(self, base_dir):
        self.base_dir = base_dir
        self.original_dir = os.path.join(base_dir, 'TotalData', 'OriginalData', 'plain_texts')
        self.processed_dir = os.path.join(base_dir, 'TotalData', 'ProcessedData', 'annotated_md')
        self.skills_dir = os.path.join(base_dir, 'skills')
        
        # Ensure directories exist
        os.makedirs(self.processed_dir, exist_ok=True)

    def lint_integrity(self, original_text, processed_text):
        """
        Verify that all non-tag original characters are preserved in the processed text.
        This is a core requirement from AI_RULES.md.
        """
        # Simple implementation: strip out our special tags and compare
        import re
        tag_pattern = re.compile(r'〖.*?〗')
        stripped_processed = tag_pattern.sub('', processed_text)
        
        # Remove extra whitespace introduced during AI processing if any
        # In a strict scenario, we want exact character matching
        return original_text.strip() == stripped_processed.strip()

    def run(self):
        logging.info("Starting Infinite Spatio-Temporal Map Data Pipeline...")
        
        if not os.path.exists(self.original_dir):
            logging.error(f"Original data directory not found: {self.original_dir}")
            return

        files = [f for f in os.listdir(self.original_dir) if f.endswith('.txt')]
        if not files:
            logging.warning("No .txt files found to process.")
            return

        for filename in files:
            logging.info(f"Processing {filename}...")
            # 1. Read Original
            with open(os.path.join(self.original_dir, filename), 'r', encoding='utf-8') as f:
                content = f.read()

            # 2. Simulate AI Task (In real scenario, this calls the LLM with entity_extractor.md)
            # For Phase 1 PoC, we do a dry run or simple pattern matching
            processed_content = self.mock_ai_extraction(content)

            # 3. Integrity Check
            if self.lint_integrity(content, processed_content):
                logging.info(f"Integrity Check PASSED for {filename}")
                # 4. Save
                target_path = os.path.join(self.processed_dir, filename.replace('.txt', '.md'))
                with open(target_path, 'w', encoding='utf-8') as f:
                    f.write(processed_content)
                logging.info(f"Saved to {target_path}")
            else:
                logging.error(f"Integrity Check FAILED for {filename}. Data loss detected!")

    def mock_ai_extraction(self, text):
        """A placeholder for the actual AI call."""
        # This will be replaced by actual LLM integration in future phases
        return f"〖⌚测试年份〗 {text}"

if __name__ == "__main__":
    # Assuming the script is in core/scripts/
    current_script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(current_script_dir)
    pipeline = DataPipeline(project_root)
    pipeline.run()
