"""Monta dist/index.html: um único arquivo com dados, lógica e UI embutidos (é assim que o artifact precisa ser).

Uso: python scripts/build_page.py [--unlocks fixtures/mysave_unlocks.json] [--label "17/11/2026"]
"""
import argparse, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ap = argparse.ArgumentParser()
ap.add_argument("--unlocks", default=os.path.join(ROOT, "fixtures", "mysave_unlocks.json"))
ap.add_argument("--label", default="17/11/2026")
a = ap.parse_args()
r = lambda p: open(os.path.join(ROOT, p), encoding="utf8").read()
parts = {
    "GAME": r("data/gamedata.json"),
    "BIOMES": r("data/biomes.json"),
    "UNLOCKS": open(a.unlocks, encoding="utf8").read(),
    "LABEL": a.label,
    "LOGIC": r("src/logic.js"),
}
# uma passada só: o conteúdo inserido nunca é reprocessado (descrições e código podem ter qualquer texto)
html = re.sub(r"__(GAME|BIOMES|UNLOCKS|LABEL|LOGIC)__", lambda m: parts[m.group(1)], r("src/template.html"))
assert "</script" not in parts["GAME"] + parts["BIOMES"], "dados com </script> quebrariam a página"
os.makedirs(os.path.join(ROOT, "dist"), exist_ok=True)
out = os.path.join(ROOT, "dist", "index.html")
open(out, "w", encoding="utf8").write(html)
print(f"{len(html.encode('utf8'))//1024} KB -> {out}")
