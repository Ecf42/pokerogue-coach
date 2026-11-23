"""Extrai do código do PokéRogue os dados que o app usa.

Gera:
  data/gamedata.json  iniciais, golpes, TMs, formas por item, custos de doces e habilidades
  data/biomes.json    biomas: pools por raridade e horário, treinadores, clima, terreno e links

Uso:
  python scripts/extract_game_data.py                    # clona os repos (sparse) em .cache/
  python scripts/extract_game_data.py --repo CAMINHO     # usa um clone do jogo já existente
  python scripts/extract_game_data.py --locales CAMINHO  # usa um clone já existente das traduções

Fontes: https://github.com/pagefaultgames/pokerogue (src/data, src/enums)
        https://github.com/pagefaultgames/pokerogue-locales (pt-BR e en, nomes e descrições)
"""
import argparse, glob, json, os, re, subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GAME_URL = "https://github.com/pagefaultgames/pokerogue.git"
LOCALES_URL = "https://github.com/pagefaultgames/pokerogue-locales.git"

# Sorteio de raridade dos selvagens (src/field/arena.ts, generateNonBossBiomeTier / generateBossBiomeTier).
# Sem sorte: comum é rolagem >= 156 em 512, incomum >= 32, raro >= 6, super raro >= 1, ultra raro = 0.
TIER_ODDS = {
    "COMMON": [356, 512], "UNCOMMON": [124, 512], "RARE": [26, 512], "SUPER_RARE": [5, 512], "ULTRA_RARE": [1, 512],
    "BOSS": [44, 64], "BOSS_RARE": [14, 64], "BOSS_SUPER_RARE": [5, 64], "BOSS_ULTRA_RARE": [1, 64],
}
TIERS = list(TIER_ODDS)
TIMES = ["ALL", "DAWN", "DAY", "DUSK", "NIGHT"]
TM_TIER = {"COMMON": 1, "GREAT": 2, "ULTRA": 3}
# Itens de forma com valor de enum abaixo deste ficam no pool Rogue (RARE_FORM_CHANGE_ITEM), o resto no Ultra
# (FormChangeItemModifierTypeGenerator em src/modifier/modifier-type.ts).
RARE_FORM_ITEM_LIMIT = 150


def ensure_repo(path, url, dirs):
    if not os.path.isdir(os.path.join(path, ".git")):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        subprocess.run(["git", "clone", "--depth", "1", "--filter=blob:none", "--sparse", url, path], check=True)
    subprocess.run(["git", "-C", path, "sparse-checkout", "add", *dirs], check=True)
    return path


def repo_info(path):
    out = subprocess.run(["git", "-C", path, "log", "-1", "--format=%H %cs"], capture_output=True, text=True)
    commit, date = (out.stdout.split() + ["?", "?"])[:2]
    return dict(commit=commit, date=date)


def read(path):
    return open(path, encoding="utf8").read()


def parse_enum(path, name):
    txt = read(path)
    body = txt[txt.index("enum " + name):]
    body = body[body.index("{") + 1:body.index("\n}")]
    body = re.sub(r"/\*.*?\*/", "", body, flags=re.S)
    body = re.sub(r"//.*", "", body)
    out, v = {}, -1
    for item in body.split(","):
        item = item.strip()
        if not item:
            continue
        if "=" in item:
            k, val = [x.strip() for x in item.split("=")]
            if re.match(r'^".*"$', val):
                out[k] = val[1:-1]
                continue
            v = int(eval(val)) if re.match(r"^[\d\s+*()-]+$", val) else out[val]
        else:
            k = item
            v += 1
        out[k] = v
    return out


def camel(key):
    """ICE_CAVE -> iceCave (chave usada nos arquivos de tradução)."""
    p = key.lower().split("_")
    return p[0] + "".join(w[:1].upper() + w[1:] for w in p[1:])


def bracket(txt, start):
    """Devolve o conteúdo entre o colchete/chave em txt[start] e o seu par."""
    pairs = {"[": "]", "{": "}", "(": ")"}
    open_c = txt[start]
    close_c, depth = pairs[open_c], 0
    for i in range(start, len(txt)):
        c = txt[i]
        if c == open_c:
            depth += 1
        elif c == close_c:
            depth -= 1
            if depth == 0:
                return txt[start + 1:i]
    raise ValueError("colchete sem par")


def field_block(b, name):
    """Conteúdo de `name: [ ... ]` ou `name: { ... }` dentro de um bloco, ou None."""
    m = re.search(r"(?<![\w])" + name + r":\s*([\[{])", b)
    return bracket(b, m.start(1)) if m else None


def const_block(t, var):
    """Conteúdo de `const var: Tipo = { ... }` (ou [ ... ])."""
    m = re.search(r"const " + var + r"\b[^=]*=\s*([\[{])", t)
    return bracket(t, m.start(1))


def form_key(expr, FK):
    expr = expr.strip()
    if expr.startswith("SpeciesFormKey."):
        return FK[expr.split(".")[1]]
    return expr.strip('"')


# ---------------------------------------------------------------- espécies

def parse_stats(b):
    def g(k):
        m = re.search(r"(?<![\w])" + k + r":\s*([^,\n]+)", b)
        return m.group(1).strip() if m else None
    stats = [int(g(k)) for k in ["baseHp", "baseAtk", "baseDef", "baseSpatk", "baseSpdef", "baseSpd"]]
    last = lambda x: (x or "null").split(".")[-1]
    return g, dict(types=[last(g("type1")), last(g("type2"))],
                   ab=[last(g("ability1")), last(g("ability2")), last(g("abilityHidden"))], stats=stats)


def parse_species(src, FK):
    species, levelmoves = {}, {}
    for f in sorted(glob.glob(src + "/data/balance/species/*.ts")):
        t = read(f)
        gm = re.search(r"generation-(\d+)", os.path.basename(f))
        gen = int(gm.group(1)) if gm else None
        parts = re.split(r"\n\s*\w+SpeciesData\[SpeciesId\.(\w+)\]\s*=\s*\{", t)
        for i in range(1, len(parts), 2):
            name, b = parts[i], parts[i + 1]
            # status, tipos e habilidades da espécie vêm antes da lista de formas; starter e starterCost, depois
            _, base = parse_stats(b.split("forms:")[0])
            g, _ = parse_stats(b)
            # bloco inteiro com colchetes balanceados: dentro dele há listas como evoDelay: [30, 35, 40]
            evo = field_block(b, "evolutions")
            evos = list(dict.fromkeys(re.findall(r"speciesId:\s*SpeciesId\.(\w+)", evo))) if evo else []
            pas_block = field_block(b, "passives")
            if pas_block is not None:  # passiva por índice de forma: { 0: AbilityId.X, 1: ... }
                passives = {int(k): v for k, v in re.findall(r"(\d+):\s*AbilityId\.(\w+)", pas_block)}
            else:
                m = re.search(r"passives:\s*AbilityId\.(\w+)", b)
                passives = {0: m.group(1)} if m else {}
            forms = []
            fb = field_block(b, "forms")
            if fb:
                for seg in fb.split("new PokemonForm(")[1:]:
                    _, fs = parse_stats(seg)
                    fn = re.search(r'formName:\s*"([^"]*)"', seg)
                    fk = re.search(r"formKey:\s*([^,\n]+)", seg)
                    fs.update(name=fn.group(1) if fn else "", key=form_key(fk.group(1), FK) if fk else "")
                    forms.append(fs)
            changes = []
            fcb = field_block(b, "formChanges")
            if fcb:
                for seg in fcb.split("new SpeciesFormChange(")[1:]:
                    it = re.search(r"trigger:\s*new SpeciesFormChangeItemTrigger\(FormChangeItem\.(\w+)", seg)
                    if not it:
                        continue
                    pre = re.search(r"preFormKey:\s*([^,\n]+)", seg).group(1)
                    to = re.search(r"evoFormKey:\s*([^,\n]+)", seg).group(1)
                    changes.append(dict(pre=form_key(pre, FK), to=form_key(to, FK), item=it.group(1)))
            tmb = field_block(b, "tms")
            sc, st = g("starterCost"), g("starter")
            etier = (g("eggTier") or "EggTier.COMMON").split(".")[-1]
            species[name] = dict(
                **base, gen=gen, bst=sum(base["stats"]), cost=int(sc) if sc else None,
                starter=st.split(".")[-1] if st else None, evos=evos,
                passive=passives.get(0), passives=passives, forms=forms, changes=changes,
                tms=re.findall(r"MoveId\.(\w+)", tmb) if tmb else [],
                egg_tier=["COMMON", "RARE", "EPIC", "LEGENDARY"].index(etier),
                mythical="mythical: true" in b, legendary="legendary: true" in b, sub="subLegendary: true" in b)
            m = re.search(r"levelMoves:\s*\[(.*?)\n\s*\],", b, re.S)
            if m:
                levelmoves[name] = [[int(l) if l.isdigit() else 0, mv]
                                    for l, mv in re.findall(r"\[\s*([\w.]+)\s*,\s*MoveId\.(\w+)\s*\]", m.group(1))]
    return species, levelmoves


def parse_moves(src):
    mt = read(src + "/data/moves/move.ts")
    moves = {}
    starts = list(re.finditer(r"new (\w*Move)\(\s*MoveId\.(\w+),\s*PokemonType\.(\w+),\s*(?:MoveCategory\.(\w+),\s*(-?\d+))?", mt))
    for j, m in enumerate(starts):
        _, name, typ, cat, pw = m.groups()
        end = starts[j + 1].start() if j + 1 < len(starts) else len(mt)
        if name not in moves:
            moves[name] = dict(t=typ, c={"PHYSICAL": "P", "SPECIAL": "E"}.get(cat, "X"), p=int(pw) if pw else 0,
                               unimpl=".unimplemented()" in mt[m.end():end])
    return moves


def parse_tm_tiers(src):
    t = read(src + "/data/balance/tm-pool-tiers.ts")
    return {mv: TM_TIER[tier] for mv, tier in re.findall(r"\[MoveId\.(\w+)\]:\s*ModifierTier\.(\w+)", t)}


TYPES_ORDER = ["NORMAL", "FIGHTING", "FLYING", "POISON", "GROUND", "ROCK", "BUG", "GHOST", "STEEL", "FIRE", "WATER",
               "GRASS", "ELECTRIC", "PSYCHIC", "ICE", "DRAGON", "DARK", "FAIRY"]


def parse_achv(src, pt):
    """Conquistas de src/system/achv.ts com nome e descrição em pt-BR.

    k chave salva em achvUnlocks, n nome, d descrição, p pontos, s secreta, c classe, v valor (contagem de fitas,
    dinheiro, dano, cura, nível, geração ou tipo do desafio)."""
    t = read(src + "/system/achv.ts")
    body = t[t.index("export const achvs = {"):]
    body = body[:body.index("\n};")]
    entries = re.split(r"\n  (\w+): new ", body)[1:]
    out = []
    generic = dict(MoneyAchv=("moneyAchv", "moneyAmount"), DamageAchv=("damageAchv", "damageAmount"),
                   HealAchv=("healAchv", "healAmount"), LevelAchv=("levelAchv", "level"), RibbonAchv=("ribbonAchv", "ribbonAmount"))
    for i in range(0, len(entries), 2):
        key, b = entries[i], entries[i + 1]
        cls = re.match(r"(\w+)\(", b).group(1)
        args = re.findall(r'"([^"]*)"|\b(\d+)\b', b.split("=>")[0])
        strs = [a for a, _ in args if a]
        nums = [int(n) for _, n in args if n]
        loc = strs[0]
        L = pt.get(loc, {})
        name = L.get("name") or loc
        val = None
        if cls in generic:
            gk, ph = generic[cls]
            val = nums[0]
            desc = pt.get(gk, {}).get("description", "").replace("{{" + ph + "}}", f"{val:,}".replace(",", ".")).replace("{{HP}}", "PS")
        else:
            desc = L.get("description", "")
        if cls == "MonoTypeChallengeAchv":
            ty = re.search(r"PokemonType\.(\w+)", b).group(1)
            val = ty
            desc = pt.get("monoType", {}).get("description", "").replace("{{type}}", ty)
        if cls == "ChallengeAchv":
            g = re.search(r"SingleGenerationChallenge\s*&&\s*c\.value === (\d+)", b)
            if g:
                val = int(g.group(1))
        # pontos: o número logo depois do nome do ícone (Classe("chave", [tipo,] [valor,] "ícone", pontos, ...))
        pts = re.search(r'^\w+\(\s*"[^"]*",\s*(?:PokemonType\.\w+,\s*)?(?:\d+,\s*)?"[^"]*",\s*(\d+)', b)
        e = dict(k=key, n=name, d=desc, p=int(pts.group(1)) if pts else None, s=1 if ".setSecret(" in b else 0, c=cls)
        if val is not None:
            e["v"] = val
        out.append(e)
    return out


def parse_candy(src):
    t = read(src + "/data/balance/starters.ts")
    rows = re.findall(r"\{\s*passive:\s*(\d+),\s*costReduction:\s*\[(\d+),\s*(\d+)\],\s*eggCost:\s*(\d+)\s*\}", t)
    assert len(rows) == 10, "tabela de doces mudou de formato"
    return [[int(x) for x in r] for r in rows]


# ---------------------------------------------------------------- biomas

def parse_biomes(src, SP, locale_pt):
    out = []
    for f in sorted(glob.glob(src + "/data/balance/biomes/*.ts")):
        t = read(f)
        bid = re.search(r"biomeId:\s*BiomeId\.(\w+)", t).group(1)
        pool = {}
        pb = const_block(t, "pokemonPool")
        for tier in TIERS:
            m = re.search(r"\[BiomePoolTier\." + tier + r"\]:\s*\{", pb)
            tb = bracket(pb, m.end() - 1)
            times = {}
            for tm in TIMES:
                mm = re.search(r"\[TimeOfDay\." + tm + r"\]:\s*\[", tb)
                sp = re.findall(r"SpeciesId\.(\w+)", bracket(tb, mm.end() - 1))
                for s in sp:
                    assert s in SP, f"{bid}: espécie desconhecida {s}"
                if sp:
                    times[tm] = sp
            if times:
                pool[tier] = times
        trainers = {}
        tb = const_block(t, "trainerPool")
        for tier, body in re.findall(r"\[BiomePoolTier\.(\w+)\]:\s*\[([^\]]*)\]", tb):
            tr = re.findall(r"TrainerType\.(\w+)", body)
            if tr:
                trainers[tier] = tr
        weather = {k: int(v) for k, v in re.findall(r"\[WeatherType\.(\w+)\]:\s*(\d+)", const_block(t, "weatherPool"))}
        terrain = {k: int(v) for k, v in re.findall(r"\[TerrainType\.(\w+)\]:\s*(\d+)", const_block(t, "terrainPool"))}
        lb = const_block(t, "biomeLinks")
        links = []
        for weighted, w, plain in re.findall(r"\[\s*BiomeId\.(\w+)\s*,\s*(\d+)\s*\]|BiomeId\.(\w+)", lb):
            links.append([weighted, int(w)] if weighted else [plain, 1])
        tc = int(re.search(r"trainerChance:\s*(\d+)", t).group(1))
        out.append(dict(k=bid, nome=locale_pt.get(camel(bid), bid), links=links, trainerChance=tc,
                        weather=weather, terrain=terrain, pool=pool, trainers=trainers))
    keys = {b["k"] for b in out}
    for b in out:
        for to, _ in b["links"]:
            assert to in keys, f"{b['k']}: link para bioma desconhecido {to}"
    return out


# ---------------------------------------------------------------- principal

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", default=os.path.join(ROOT, ".cache", "pokerogue"))
    ap.add_argument("--locales", default=os.path.join(ROOT, ".cache", "pokerogue-locales"))
    args = ap.parse_args()
    repo = ensure_repo(args.repo, GAME_URL, ["src/data", "src/enums", "src/system"])
    loc = ensure_repo(args.locales, LOCALES_URL, ["en", "pt-BR"])
    src = os.path.join(repo, "src")
    lj = lambda lang, f: json.load(open(os.path.join(loc, lang, f), encoding="utf8"))
    ABIL_PT = lj("pt-BR", "ability.json")
    ITEM_EN = lj("en", "modifier-type.json")["FormChangeItem"]

    SP = parse_enum(src + "/enums/species-id.ts", "SpeciesId")
    FK = parse_enum(src + "/enums/species-form-key.ts", "SpeciesFormKey")
    FCI = parse_enum(src + "/enums/form-change-item.ts", "FormChangeItem")
    S, LV = parse_species(src, FK)
    MOVES = parse_moves(src)
    TMT = parse_tm_tiers(src)
    em_txt = read(src + "/data/balance/moves/egg-moves.ts")
    EM = {k: re.findall(r"MoveId\.(\w+)", v) for k, v in re.findall(r"\[SpeciesId\.(\w+)\]:\s*\[([^\]]*)\]", em_txt)}

    def paths(n, seen=()):
        ev = [e for e in S[n]["evos"] if e in S and e not in seen]
        if not ev:
            return [[n]]
        out = []
        for e in ev:
            out += [[n] + p for p in paths(e, seen + (n,))]
        return out

    mvlist, mvidx = [], {}
    def mi(m):
        if m not in MOVES:
            return None
        if m not in mvidx:
            mvidx[m] = len(mvlist)
            mv = MOVES[m]
            mvlist.append([m, mv["t"], mv["c"], mv["p"], TMT.get(m, 0)])
        return mvidx[m]

    used_abilities = set()
    def ab_used(*names):
        used_abilities.update(a for a in names if a and a != "NONE")

    def item_forms(species_list):
        """Formas por item das espécies da linha (Mega, Gigantamax, Primal, Origin, placas...).

        Entram todos os ramos da linha evolutiva, não só o do `f`: o Pichu segue para Alola Raichu, mas as Megas
        X/Y são do Raichu comum. O campo `sp` diz qual espécie precisa estar no time para usar o item."""
        out, seen = [], set()
        for sp in species_list:
            s = S[sp]
            idx = {f["key"]: i for i, f in enumerate(s["forms"])}
            for ch in s["changes"]:
                # a mesma forma pode vir de formas de origem diferentes (Pikachu normal e "partner"): fica a primeira
                if ch["to"] not in idx or (sp, ch["to"]) in seen:
                    continue
                seen.add((sp, ch["to"]))
                f = s["forms"][idx[ch["to"]]]
                k = ch["to"]
                acc = "mega" if ("mega" in k or k == "primal") else "gmax" if ("gigantamax" in k or k == "eternamax") else None
                pa = s["passives"].get(idx[k], s["passives"].get(0))
                ab_used(*f["ab"], pa)
                e = dict(sp=sp, n=f["name"], k=k, it=ITEM_EN.get(ch["item"], ch["item"]),
                         rare=1 if 0 < FCI[ch["item"]] < RARE_FORM_ITEM_LIMIT else 0, acc=acc,
                         ty=[x for x in f["types"] if x != "null"], st=f["stats"], ab=f["ab"], pa=pa)
                if ch["pre"]:
                    e["de"] = ch["pre"]
                out.append(e)
        return out

    DEFAULT_STARTERS = set(re.findall(r"SpeciesId\.(\w+)", read(src + "/constants.ts").split("defaultStarterSpecies")[1].split("];")[0]))
    starters, starter_tms = [], []
    for n, s in S.items():
        if not s["cost"] or s.get("starter") != n:
            continue
        all_paths = paths(n)
        p = max(all_paths, key=lambda p: S[p[-1]]["bst"])
        F = S[p[-1]]
        mv = []
        for sp in p:
            for _, m in LV.get(sp, []):
                i = mi(m)
                if i is not None and i not in mv:
                    mv.append(i)
        # TMs: as da forma final mais as das pré evoluções (SpeciesDataRegistry.getTms). A loja ignora golpes
        # não implementados (TmModifierTypeGenerator) e só sorteia os que têm tier em tm-pool-tiers.ts.
        starter_tms.append({m for sp in p for m in S[sp]["tms"] if m in TMT and m in MOVES and not MOVES[m]["unimpl"]})
        lg = 3 if s["mythical"] else 1 if s["legendary"] else 2 if s["sub"] else 0
        ab_used(*F["ab"], s["passive"], F["passive"])
        e = dict(k=n, id=SP[n], f=p[-1], ty=[t for t in F["types"] if t != "null"], st=F["stats"],
                 ab=F["ab"], pa=s["passive"], em=[mi(m) for m in EM.get(n, [])], c=s["cost"],
                 lg=lg, mv=mv, ch=len(p), et=s["egg_tier"])
        # O jogo usa a passiva da espécie atual (PokemonSpecies.getPassiveAbility). Quando a forma final tem
        # passiva diferente da do inicial, guardamos as duas: pa (inicial, igual à tela de seleção) e paf (final).
        if F["passive"] and F["passive"] != s["passive"]:
            e["paf"] = F["passive"]
        # ln: [espécie, geração, tipos, total, índice da pré evolução em ln (-1 no inicial)]
        ln, at = [], {}
        for path in all_paths:
            for j, sp in enumerate(path):
                if sp not in at:
                    at[sp] = len(ln)
                    ln.append([sp, S[sp]["gen"], [t for t in S[sp]["types"] if t != "null"], S[sp]["bst"], at[path[j - 1]] if j else -1])
        e["ln"] = ln
        if n in DEFAULT_STARTERS:
            e["ds"] = 1
        fo = item_forms(list(dict.fromkeys(sp for path in all_paths for sp in path)))
        if fo:
            e["fo"] = fo
        starters.append(e)

    # TMs em bitset hexadecimal sobre a lista global `tms` (índices em `moves`): bit j ligado = aprende tms[j].
    # O caractere j//4 guarda os bits j..j+3, bit menos significativo primeiro. Listas de índices dobravam o JSON.
    tms = [mi(m) for m in sorted(set().union(*starter_tms))]
    pos = {mvlist[i][0]: j for j, i in enumerate(tms)}
    for e, learn in zip(starters, starter_tms):
        nib = [0] * ((len(tms) + 3) // 4)
        for m in learn:
            nib[pos[m] // 4] |= 1 << (pos[m] % 4)
        e["tm"] = "".join("%x" % v for v in nib).rstrip("0")

    abilities = {}
    for a in sorted(used_abilities):
        loc_e = ABIL_PT.get(camel(a))
        if loc_e:
            abilities[a] = [loc_e.get("name", a), loc_e.get("description", "")]

    game_info = repo_info(repo)
    out = os.path.join(ROOT, "data", "gamedata.json")
    json.dump(dict(src=game_info, starters=starters, moves=mvlist, tms=tms, abilities=abilities, candy=parse_candy(src),
                   achv=parse_achv(src, lj("pt-BR", "achv.json"))),
              open(out, "w", encoding="utf8"), separators=(",", ":"), ensure_ascii=False)
    print(f"{len(starters)} iniciais, {len(mvlist)} golpes, {len(abilities)} habilidades -> {out}")

    biomes = parse_biomes(src, SP, lj("pt-BR", "biomes.json"))
    bout = os.path.join(ROOT, "data", "biomes.json")
    json.dump(dict(src=game_info, tierOdds=TIER_ODDS, biomes=biomes),
              open(bout, "w", encoding="utf8"), separators=(",", ":"), ensure_ascii=False)
    print(f"{len(biomes)} biomas -> {bout}")

    # ---- dex.json: o necessário para ler uma sessão ou o histórico de runs (ids numéricos -> nomes e tipos)
    def by_id(enum):
        arr = [None] * (max(v for v in enum.values() if isinstance(v, int)) + 1)
        for k, v in enum.items():
            if isinstance(v, int) and v >= 0 and arr[v] is None:
                arr[v] = k
        return arr
    abil_list, abil_idx = [], {}
    def ai(a):
        if a not in abil_idx:
            abil_idx[a] = len(abil_list)
            abil_list.append(a)
        return abil_idx[a]
    ai("NONE")
    species = []
    for name, s in S.items():
        if name not in SP:
            continue
        t2 = s["types"][1]
        # [id, KEY, tipo1, tipo2, hab1, hab2, oculta, total, passiva] (habilidades como índice em `abilities`)
        species.append([SP[name], name, s["types"][0], "" if t2 == "null" else t2, *[ai(a) for a in s["ab"]], s["bst"], ai(s["passive"] or "NONE")])
    MV = parse_enum(src + "/enums/move-id.ts", "MoveId")
    # BiomeId é um objeto `const`, não um enum, e tem buracos (SLUM = 30, END = 50)
    bt = read(src + "/enums/biome-id.ts")
    BI = {k: int(v) for k, v in re.findall(r"^\s*(\w+):\s*(\d+),", const_block(bt, "BiomeId"), re.M)}
    TT = parse_enum(src + "/enums/trainer-type.ts", "TrainerType")
    FW = parse_enum(src + "/enums/fixed-boss-waves.ts", "ClassicFixedBossWaves")
    GM = parse_enum(src + "/enums/game-modes.ts", "GameModes")
    # pré evolução de cada espécie (para achar onde aparece a linha de um Pokémon: o Charizard sai do Charmander)
    prevo = {}
    for name, s in S.items():
        for e in s["evos"]:
            prevo.setdefault(e, name)
    dex = dict(src=game_info, prevo=prevo, species=sorted(species), abilities=abil_list, moves=by_id(MV), biomes=by_id(BI), gameModes=by_id(GM),
               trainers=by_id(TT), classicFixed=sorted([[w, k] for k, w in FW.items()]))
    dout = os.path.join(ROOT, "data", "dex.json")
    json.dump(dex, open(dout, "w", encoding="utf8"), separators=(",", ":"), ensure_ascii=False)
    print(f"{len(species)} espécies, {sum(1 for m in dex['moves'] if m)} golpes, {len(dex['trainers'])} treinadores -> {dout}")


if __name__ == "__main__":
    main()
