import math

PETROL="#0e2e47"; STEEL="#479bbf"; STEEL_D="#1b6489"; RED="#e6232f"; WHITE="#ffffff"; SKY="#9ccfe6"

THEMES = {
  "dark":    dict(bg=PETROL, disc=None,  ring=STEEL,   outer=STEEL,   mark=WHITE,  hub=PETROL),
  "light":   dict(bg=WHITE,  disc=None,  ring=STEEL_D, outer=STEEL_D, mark=PETROL, hub=WHITE),
  "lightB":  dict(bg=WHITE,  disc=PETROL, ring=STEEL,  outer=STEEL_D, mark=WHITE,  hub=PETROL),
  # teste: ponteiros e marcadores em azul claro
  "darkSky": dict(bg=PETROL, disc=None,  ring=STEEL,   outer=STEEL,   mark=SKY,    hub=PETROL),
}

# hour/minute = (largura, comprimento, comprimento da cauda, nariz)
TIERS = {
  "icon12": dict(scale=1.34, ring_r=117, ring_w=16, thin=False, minutes=False, bars="all", bar_w=9,  bar_r=(78,101),
               outer=True, outer_w=9, outer_w2=7, tri=(14,106,78), hour=(12,48,18,6), minute=(10,86,22,9), sec=True, hub=(8,11.5)),
  "iconc": dict(scale=1.34, ring_r=117, ring_w=16, thin=False, minutes=False, bars="all", bar_w=9,  bar_r=(78,101),
               outer=True, outer_cardinal=True, outer_w=9, tri=(14,106,78), hour=(12,48,18,6), minute=(10,86,22,9), sec=True, hub=(8,11.5)),
  "full": dict(scale=1.36, ring_r=118, ring_w=14, thin=True,  minutes=True,  bars="all", bar_w=5,  bar_r=(78,101),
               outer=True, tri=(12,106,82), hour=(10,50,22,5), minute=(9,90,26,9),  sec=True, hub=(6.5,9.5)),
  "icon": dict(scale=1.58, ring_r=117, ring_w=16, thin=False, minutes=False, bars="all", bar_w=9,  bar_r=(78,101),
               outer=False, tri=(14,106,78), hour=(12,48,18,6), minute=(10,86,22,9), sec=True, hub=(8,11.5)),
  "tiny": dict(scale=1.70, ring_r=114, ring_w=22, thin=False, minutes=False, bars="cardinal", bar_w=14, bar_r=(74,100),
               outer=False, tri=(17,106,70), hour=(15,44,14,7), minute=(12,80,16,10), sec=False, hub=(9,12.5)),
}

def pt(a, r):
    t = math.radians(a); return (r*math.sin(t), -r*math.cos(t))

def tick(a, r1, r2, w, color, cap="butt"):
    x1,y1 = pt(a,r1); x2,y2 = pt(a,r2)
    return f'<line x1="{x1:.2f}" y1="{y1:.2f}" x2="{x2:.2f}" y2="{y2:.2f}" stroke="{color}" stroke-width="{w}" stroke-linecap="{cap}"/>'

def hand(angle, w, L, tail, nose, color):
    h = w/2
    pts = [(-h, tail), (-h, -(L-nose)), (0, -L), (h, -(L-nose)), (h, tail-0.45*w)]
    s = " ".join(f"{x:.2f},{y:.2f}" for x,y in pts)
    return f'<polygon points="{s}" fill="{color}" transform="rotate({angle})"/>'

def _body(theme, tier):
    c = THEMES[theme]; p = TIERS[tier]; g = []
    if c["disc"]:
        g.append(f'<circle r="{p["ring_r"]+p["ring_w"]/2}" fill="{c["disc"]}"/>')
    g.append(f'<circle r="{p["ring_r"]}" fill="none" stroke="{c["ring"]}" stroke-width="{p["ring_w"]}"/>')
    if p["thin"]:
        g.append(f'<circle r="104" fill="none" stroke="{c["ring"]}" stroke-width="1.5"/>')
    if p["minutes"]:
        for i in range(60):
            if i % 5: g.append(tick(i*6, 95, 100, 1.4, c["mark"]))
    for a in range(30,360,30):
        if p["bars"] == "cardinal" and a % 90: continue
        r1,r2 = p["bar_r"]
        g.append(tick(a, r1, r2, p["bar_w"], c["mark"]))
    hw, ty, tb = p["tri"]
    g.append(f'<polygon points="{-hw},{-ty} {hw},{-ty} 0,{-tb}" fill="{RED}"/>')
    if p["outer"]:
        for a in range(0,360,30):
            if a % 90 == 0: g.append(tick(a, 138, 152, p.get("outer_w",6), c["outer"], "round"))
            elif not p.get("outer_cardinal"): g.append(tick(a, 141, 150, p.get("outer_w2",5), c["outer"], "round"))
    hw_,hl,ht,hn = p["hour"]; mw,ml,mt,mn = p["minute"]
    g.append(hand(304, hw_, hl, ht, hn, c["mark"]))   # 10:08
    g.append(hand(48,  mw,  ml, mt, mn, c["mark"]))
    hub_r, halo_r = p["hub"]
    g.append(f'<circle r="{halo_r}" fill="{c["hub"]}"/>')
    if p["sec"]:
        s = [(-1.4,-76),(1.4,-76),(2.6,0),(3.0,18),(0,34),(-3.0,18),(-2.6,0)]
        g.append('<polygon points="' + " ".join(f"{x},{y}" for x,y in s) + f'" fill="{RED}"/>')
    g.append(f'<circle r="{hub_r}" fill="{RED}"/>')
    return "\n  ".join(g)

def build_mark(theme="lightB", tier="icon"):
    """Marca sem fundo (disco incluso), viewBox centrado: usada pelo componente Logo."""
    p = TIERS[tier]; r = p["ring_r"] + p["ring_w"] / 2
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{-r:g} {-r:g} {2*r:g} {2*r:g}">\n  '
            + _body(theme, tier) + "\n</svg>\n")

def build_mark_tsx():
    """Mesma marca como JSX (gera src/components/logo-mark.tsx)."""
    import re
    inner = _body("lightB", "icon")
    inner = inner.replace("stroke-width", "strokeWidth").replace("stroke-linecap", "strokeLinecap")
    inner = inner.replace("\n  ", "\n      ")
    r = TIERS["icon"]["ring_r"] + TIERS["icon"]["ring_w"] / 2
    return f'''// GERADO por brand/relogio/gerar-logo.py — não editar à mão (logo-mark.test.ts confere).
export function LogoMark({{ className }}: {{ className?: string }}) {{
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="{-r:g} {-r:g} {2*r:g} {2*r:g}" aria-hidden="true" focusable="false" className={{className}}>
      {inner}
    </svg>
  );
}}
'''

def build(theme, tier, size=512, rounded=False):
    c = THEMES[theme]; p = TIERS[tier]
    body = _body(theme, tier)
    rx = ' rx="112"' if rounded else ''
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="{size}" height="{size}">
  <rect width="512" height="512" fill="{c["bg"]}"{rx}/>
  <g transform="translate(256 256) scale({p["scale"]})">
  {body}
  </g>
</svg>'''


if __name__ == "__main__":
    import pathlib
    here = pathlib.Path(__file__).parent
    (here / "compasso-marca.svg").write_text(build_mark())
    (here.parents[1] / "src/components/logo-mark.tsx").write_text(build_mark_tsx())
