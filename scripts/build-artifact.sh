#!/usr/bin/env bash
# Gera a variante incorporável (rotas em memória, caminhos relativos) em dist-artifact/.
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf dist-artifact
VITE_ROUTER=memory npx vite build --base ./ --outDir dist-artifact >/dev/null
cd dist-artifact
JS=$(ls assets | grep -E '^index-.*\.js$')
CSS=$(ls assets | grep -E '^index-.*\.css$')
# o publicador recusa o caractere U+FFFD literal; a sequência de escape é equivalente
python3 -I -c "
import glob
for f in glob.glob('assets/*.js'):
    s=open(f,encoding='utf-8').read()
    if '�' in s: open(f,'w',encoding='utf-8').write(s.replace('�','\\\\uFFFD'))
"
cat > casa-em-dia.html <<HTML
<title>Casa em Dia</title>
<script>document.documentElement.classList.add('dark'); document.documentElement.lang = 'pt-BR'</script>
<link rel="stylesheet" href="assets/$CSS">
<div id="root"></div>
<script type="module" src="assets/$JS"></script>
HTML
rm -f index.html favicon.svg
ls assets | grep -E '\.(js|css)$'
