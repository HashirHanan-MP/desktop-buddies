# Desktop Buddies: Android launcher + notification icons from build/icon.png / build/tray-cat.png
import os, sys
from PIL import Image

root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
res = os.path.join(root, 'android', 'res')
icon = Image.open(os.path.join(root, 'build', 'icon.png')).convert('RGBA')
for name, size in {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}.items():
    d = os.path.join(res, 'mipmap-' + name)
    os.makedirs(d, exist_ok=True)
    icon.resize((size, size), Image.LANCZOS).save(os.path.join(d, 'ic_launcher.png'))

# status-bar icon: white silhouette on transparent (Android tints it)
tray = Image.open(os.path.join(root, 'build', 'tray-cat.png')).convert('RGBA')
alpha = tray.getchannel('A')
for name, size in {'mdpi': 24, 'hdpi': 36, 'xhdpi': 48, 'xxhdpi': 72, 'xxxhdpi': 96}.items():
    d = os.path.join(res, 'drawable-' + name)
    os.makedirs(d, exist_ok=True)
    a = alpha.resize((size, size), Image.LANCZOS)
    out = Image.new('RGBA', (size, size), (255, 255, 255, 0))
    out.putalpha(a)
    out.save(os.path.join(d, 'ic_stat.png'))
print('icons written to', res)
