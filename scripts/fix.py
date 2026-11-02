import os
import glob
import re

for filepath in glob.glob("*.html"):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    
    # Check if dark-mode.css is inside
    if "css/dark-mode.css" in content:
        # Remove ALL occurrences of dark-mode.css link
        content = re.sub(r'<link[^>]*href=[\'"]css/dark-mode\.css[\'"][^>]*>\s*', '', content)
        
        # Insert just before </head>
        content = content.replace("</head>", '    <link rel="stylesheet" href="css/dark-mode.css">\n</head>')
        
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Fixed {filepath}")
