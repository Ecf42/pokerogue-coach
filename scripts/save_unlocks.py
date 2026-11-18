"""Converte o save descriptografado (data.json) no formato compacto de desbloqueios que o app embute.

Saída: {speciesId: [valueReduction, abilityAttr, passiveAttr, eggMoves, natureAttr, ivs[6], candyCount]}
Só entram espécies capturadas (dexData.$ca != 0).

Uso: python scripts/save_unlocks.py data.json fixtures/mysave_unlocks.json
"""
import json, sys
d = json.load(open(sys.argv[1]))
g = lambda o, a, b: o.get(a, o.get(b))
out = {}
for sid, st in d["starterData"].items():
    dex = d["dexData"].get(sid, {})
    if not g(dex, "$ca", "caughtAttr"):
        continue
    out[sid] = [g(st, "$vr", "valueReduction") or 0, g(st, "$a", "abilityAttr") or 0, g(st, "$pa", "passiveAttr") or 0,
                g(st, "$em", "eggMoves") or 0, int(g(dex, "$na", "natureAttr") or 0), g(dex, "$i", "ivs"), g(st, "$x", "candyCount") or 0]
json.dump(out, open(sys.argv[2], "w"), separators=(",", ":"))
print(len(out), "espécies ->", sys.argv[2])
