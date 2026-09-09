import re

with open(r'C:\Users\QING\.gemini\antigravity-ide\brain\3821aa0a-4cff-4990-9a59-f45147cebdb0\scratch\image_matches.txt', 'r', encoding='utf-8') as f:
    text = f.read()

urls = re.findall(r'https?://[^\s<>"\'\)]+', text)
img_urls = [u for u in urls if any(ext in u.lower() for ext in ['.png', '.jpg', '.jpeg', '.webp', 'cloudinary', 'res.cloudinary'])]
for u in set(img_urls):
    print(u)
