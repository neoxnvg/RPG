"""Bundle the production build and CC0 character into a downloadable HTML."""
from pathlib import Path
import base64
import re
import sys
root = Path(__file__).resolve().parents[1]
html = (root / 'dist/index.html').read_text()
js = next((root / 'dist/assets').glob('*.js')).read_text()
css = next((root / 'dist/assets').glob('*.css')).read_text()
model = base64.b64encode((root / 'public/models/RobotExpressive.glb').read_bytes()).decode()
for model_path in ('./models/RobotExpressive.glb', '/models/RobotExpressive.glb'):
    js = js.replace(model_path, 'data:model/gltf-binary;base64,' + model)
html = re.sub(r'<script type="module"[^>]*src="[^"]+"[^>]*></script>', '', html)
html = re.sub(r'<link rel="stylesheet"[^>]*>', '', html)
html = html.replace('</head>', '<style>' + css + '</style></head>')
html = html.replace('</body>', '<script type="module">' + js.replace('</script', '<\\/script') + '</script></body>')
output = Path(sys.argv[1]) if len(sys.argv) > 1 else root / 'dist/Aether-jogar.html'
output.write_text(html)
print(output)
