import glob
import re

for file_path in glob.glob('*.html'):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find the tag
    tag_pattern = r'<link[^>]*href="css/dark-mode.css"[^>]*>\n?'
    
    if not re.search(tag_pattern, content):
        continue

    # Remove it
    new_content = re.sub(tag_pattern, '', content)
    
    # Insert it right before </head>
    new_content = re.sub(r'(</head>)', r'<link rel="stylesheet" href="css/dark-mode.css">\n\t\1', new_content, flags=re.IGNORECASE)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
        
print("Updated HTML files.")
