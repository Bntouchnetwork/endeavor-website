#!/usr/bin/env python3
"""Gera o tema claro da sala do Web Meeting a partir das cores de room.css.

Lê room.css (parte escura, antes do marcador), troca cada cor escura/clara pela equivalente do tema claro
e grava as regras com o prefixo `.sala.tema-claro` no fim do próprio room.css, entre os marcadores.
Rode de novo sempre que mudar cores em room.css:  python3 meet/gerar-tema-claro.py
"""
import re, pathlib

ARQ = pathlib.Path(__file__).with_name("room.css")
INICIO, FIM = "/* ===== tema claro (gerado por gerar-tema-claro.py; não edite à mão) ===== */", "/* ===== fim do tema claro ===== */"

# sobreposições em cima do vídeo continuam com as cores do tema escuro (fundo translúcido preto)
EXTRAS = """.sala.tema-claro .tile .rot{color:#fff}
.sala.tema-claro .legendas b{color:#e3cf9f}
.sala.tema-claro .tile .rot .papel{background:#fff;color:#07162b}
.sala.tema-claro .faixa-pessoas{background:transparent;border-left:0}
.sala.tema-claro .faixa-lista .tile:not(.falando){border:1px solid #b3b9c2;box-shadow:0 1px 4px rgba(15,29,51,.12)}
.sala.tema-claro .plateia .tile:not(.falando){border:1px solid #b3b9c2}
.sala.tema-claro.tela-cheia .controles-sala{background:rgba(220,223,228,.92)}"""

# fundos e bordas: azul-escuro -> tons claros
FUNDO = {
    # cinza neutro (um tom mais escuro que branco), para não cansar a vista
    "#07162b": "#dcdfe4", "#061226": "#d3d7dd", "#081a33": "#e9ebee", "#0a1c36": "#e6e8eb", "#0b1d38": "#eef0f2", "#0e2443": "#e3e6ea",
    "#0f2545": "#d6dadf", "#13294b": "#d2d6dc", "#132c52": "#d0d5db", "#15305a": "#c9ced5", "#16305a": "#c6cbd3", "#17325c": "#cdd2d8",
    "#1a3660": "#cdd2d8", "#1d3a66": "#c8cdd4", "#213f6d": "#bfc5cd", "#244372": "#bac1ca", "#2a4a7a": "#adb4be", "#3a5d90": "#9aa2ad",
    "#3f6398": "#959eaa", "#4c6a96": "#868f9b", "#5c7fb3": "#7b8592", "#0b1f3a": "#d6dadf", "#061428": "transparent",
    "#fff": "#0f2545", "#ffffff": "#0f2545",
}
# texto: claro -> escuro; escuro (usado sobre fundo branco) -> branco
TEXTO = {
    "#fff": "#0f1d33", "#ffffff": "#0f1d33", "#ddd": "#2b3a52", "#eee": "#2b3a52", "#e6ecf5": "#22324a", "#cfcfcf": "#3a4a62", "#e6e6e6": "#2b3a52",
    "#a8a8a8": "#5b6576", "#aaa": "#5b6576", "#bbb": "#4f5a6b", "#a8b6cc": "#56657c", "#888": "#5b6576", "#777": "#5b6576", "#c7d2e3": "#3a4a62",
    "#8fe0b0": "#1f7a4d", "#ff8a80": "#b42318",
    "#07162b": "#ffffff", "#0b1f3a": "#ffffff", "#e3cf9f": "#7a5a17", "#c8a45d": "#7a5a17", "#ffd7d7": "#8a1c1c", "#ffb3b3": "#8a1c1c",
}
PROPS_FUNDO = ("background", "background-color", "border", "border-color", "border-left", "border-right", "border-top", "border-bottom", "outline", "box-shadow")

def trocar(valor, mapa):
    return re.sub(r"#[0-9a-fA-F]{3,6}\b", lambda m: mapa.get(m.group(0).lower(), m.group(0)), valor)

def regras(css):
    """Divide em (prefixo_media, seletor, declarações), com um nível de @media."""
    out, i, n = [], 0, len(css)
    def bloco(texto, media):
        for m in re.finditer(r"([^{}]+)\{([^{}]*)\}", texto):
            sel = m.group(1).strip()
            if sel.startswith("@"): continue
            out.append((media, sel, m.group(2)))
    # separa os @media (com chaves aninhadas) do resto
    resto, pos = [], 0
    for m in re.finditer(r"@media[^{]+\{", css):
        if m.start() < pos: continue
        resto.append(css[pos:m.start()])
        prof, j = 1, m.end()
        while j < n and prof:
            prof += {"{": 1, "}": -1}.get(css[j], 0); j += 1
        bloco(css[m.end():j - 1], m.group(0)[:-1].strip())
        pos = j
    resto.append(css[pos:])
    bloco("".join(resto), "")
    return out

def gerar():
    css = ARQ.read_text()
    base = css.split(INICIO)[0].rstrip() + "\n"
    base_sem_coment = re.sub(r"/\*.*?\*/", "", base, flags=re.S)
    linhas = []
    for media, sel, decl in regras(base_sem_coment):
        novas = []
        decls = [(d.split(":", 1)[0].strip().lower(), d.split(":", 1)[1]) for d in decl.split(";") if ":" in d]
        # fundo que não muda (dourado, vermelho, sobreposição translúcida): o texto também fica como está
        fundos = [v for p, v in decls if p in ("background", "background-color")]
        fundo_fixo = any(trocar(v, FUNDO) == v and not re.search(r"\b(none|transparent)\b", v) for v in fundos)
        for p, v in decls:
            if p == "color": nv = v if fundo_fixo else trocar(v, TEXTO)
            elif p in PROPS_FUNDO or p.startswith("background"): nv = trocar(v, FUNDO)
            else: continue
            # repete também o que não muda, para manter a ordem da cascata dentro do tema claro
            novas.append(f"{p}:{nv.strip()}")
        if not novas: continue
        raiz = lambda x: re.match(r"^\.sala(?=[\s.:#\[>]|$)", x)
        seletores = ",".join(s.strip().replace(".sala", ".sala.tema-claro", 1) if raiz(s.strip()) else ".sala.tema-claro " + s.strip() for s in sel.split(","))
        regra = seletores + "{" + ";".join(novas) + "}"
        linhas.append(media + "{" + regra + "}" if media else regra)
    ARQ.write_text(base + "\n" + INICIO + "\n.sala.tema-claro{color-scheme:light}\n" + "\n".join(linhas) + "\n" + EXTRAS + "\n" + FIM + "\n")
    print(f"{len(linhas)} regras do tema claro")

if __name__ == "__main__":
    gerar()
