#!/usr/bin/env python3
"""v4.7.0: harder puzzles by structure (more colours, fewer empty flasks, interleaved layers),
NOT by cutting moves. Every ordinary flask = 4 portions; only the collector vessel is tall.
No mixing. Each level keeps its mechanic (hidden / locked / frozen / filter / workshop / collector).
Every level gets a solver witness (weighted A* on an exact model of the v4.6 engine);
move limit keeps the OLD relative spare-move margin (%), so the budget is never tighter.
The witness is then replayed in the real game by scripts/smoke_v470.mjs."""
import json, random, heapq, math, sys, time
from multiprocessing import Pool
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PACK = ROOT / 'www/assets/paint_levels.json'
CAP = 4
PALETTE = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'teal', 'brown']

# ---------------- engine model (mirrors www/game.js canPour/finishPour/tryCompleteFlask) -------------
class Lvl:
    def __init__(s, flasks, caps, locked, lockColor, thaw, filt, coll_idx, coll_color, coll_need, order):
        s.n = len(flasks); s.start = tuple(tuple(f) for f in flasks); s.caps = caps
        s.locked0 = sum(1 << i for i, v in enumerate(locked) if v); s.lockColor = lockColor
        s.thaw0 = tuple(thaw); s.filt = filt; s.ci = coll_idx; s.cc = coll_color; s.cn = coll_need
        s.order = order or None
        s.ncolors = len(set(c for f in flasks for c in f))

def top_run(f):
    if not f: return None, 0
    c = f[-1]; n = 0
    for x in reversed(f):
        if x != c: break
        n += 1
    return c, n

def moves_from(L, st):
    fl, ck, lk, th = st
    out = []
    for i in range(L.n):
        if (ck >> i) & 1 or (lk >> i) & 1 or th[i] > 0 or i == L.ci: continue
        src = fl[i]
        if not src: continue
        c, run = top_run(src)
        for j in range(L.n):
            if j == i or (ck >> j) & 1 or (lk >> j) & 1 or th[j] > 0: continue
            dst = fl[j]
            if j == L.ci:
                if c != L.cc: continue
                sp = L.caps[j] - len(dst)
                if sp <= 0: continue
                out.append((i, j, min(run, sp))); continue
            if L.filt[j] and c != L.filt[j]: continue
            sp = L.caps[j] - len(dst)
            if sp <= 0: continue
            if dst:
                if dst[-1] != c: continue
            else:
                if run == len(src) and L.ci != i: continue  # pointless: whole mono content into empty
            out.append((i, j, min(run, sp)))
    return out

def apply(L, st, mv):
    fl, ck, lk, th = st
    i, j, a = mv
    fl = list(fl)
    src = fl[i]; dst = fl[j]
    moved = src[len(src) - a:]
    fl[i] = src[:len(src) - a]; fl[j] = dst + moved
    d = fl[j]
    if j != L.ci and len(d) == L.caps[j] and len(set(d)) == 1 and not (L.cc and d[0] == L.cc):
        ck |= 1 << j
        col = d[0]
        for k in range(L.n):
            if (lk >> k) & 1 and L.lockColor[k] == col: lk &= ~(1 << k)
        th = tuple(max(0, t - 1) if t > 0 else 0 for t in th)
    return (tuple(fl), ck, lk, th)

def won(L, st):
    fl, ck, lk, th = st
    if L.ci is not None and L.ci >= 0:
        c = fl[L.ci]
        return len(c) >= L.cn and all(x == L.cc for x in c)
    if L.order:
        have = set(fl[i][0] for i in range(L.n) if (ck >> i) & 1)
        if all(o in have for o in L.order): return True
    for i in range(L.n):
        if fl[i] and not ((ck >> i) & 1): return False
    return True

def heur(L, st):
    fl, ck, lk, th = st
    if L.ci is not None and L.ci >= 0:
        # target units not yet in vessel + units sitting on top of them
        h = L.cn - len(fl[L.ci])
        for i, f in enumerate(fl):
            if i == L.ci: continue
            seen = False
            for k, x in enumerate(f):
                if x == L.cc: seen = True
            if seen:
                # layers above the lowest target unit that are not target need moving
                lo = f.index(L.cc)
                h += sum(1 for x in f[lo:] if x != L.cc) * 0.5
        return h
    seg = 0; cols = set()
    for i, f in enumerate(fl):
        if (ck >> i) & 1 or not f: continue
        prev = None
        for x in f:
            if x != prev: seg += 1; prev = x
            cols.add(x)
        # a non-mono flask whose bottom colour must eventually leave
    h = seg - len(cols)
    if L.order:
        h = 0
        for o in L.order:
            done = any((ck >> i) & 1 and fl[i][0] == o for i in range(L.n))
            if done: continue
            s = 0
            for i, f in enumerate(fl):
                if (ck >> i) & 1: continue
                prev = None
                for x in f:
                    if x == o and prev != o: s += 1
                    prev = x
            h += max(1, s)
    h += sum(1 for t in th if t > 0) * 0  # thaw is implied by corks
    return h

def solve(L, w=2.0, limit=400000):
    s0 = (L.start, 0, L.locked0, L.thaw0)
    cnt = 0
    openh = [(w * heur(L, s0), 0, cnt, s0)]
    g = {s0: 0}; par = {s0: None}
    exp = 0
    while openh:
        f, gg, _, st = heapq.heappop(openh)
        if gg > g.get(st, 1e9): continue
        if won(L, st):
            path = []
            while par[st] is not None:
                pst, mv = par[st]; path.append(mv); st = pst
            return path[::-1], exp
        exp += 1
        if exp > limit: return None, exp
        for mv in moves_from(L, st):
            ns = apply(L, st, mv)
            ng = gg + 1
            if ng < g.get(ns, 1e9):
                g[ns] = ng; par[ns] = (st, mv); cnt += 1
                heapq.heappush(openh, (ng + w * heur(L, ns), ng, cnt, ns))
    return None, exp

# ---------------- generation ----------------
def deal(rng, colors, fills, coll_color=None, coll_need=0):
    """fills: list of target lengths per flask. Interleave: no two equal neighbours inside a flask."""
    units = []
    for c in colors:
        units += [c] * (coll_need if c == coll_color else CAP)
    for _ in range(4000):
        rng.shuffle(units)
        out = []; k = 0; ok = True
        pool = units[:]
        flasks = [[] for _ in fills]
        # greedy placement avoiding adjacent duplicates
        order = list(range(len(fills)))
        for fi in order:
            for _ in range(fills[fi]):
                cand = [u for u in set(pool) if not flasks[fi] or flasks[fi][-1] != u]
                if not cand: ok = False; break
                # prefer colours with most remaining units (keeps solvable spread)
                cand.sort(key=lambda u: (-pool.count(u), rng.random()))
                u = cand[0] if rng.random() < 0.55 else rng.choice(cand)
                pool.remove(u); flasks[fi].append(u)
            if not ok: break
        if not ok or pool: continue
        # no flask may start full-mono (would pre-cork) and no colour may sit 3+ in one flask
        bad = False
        for f in flasks:
            for c in set(f):
                if f.count(c) >= 3: bad = True
        if bad: continue
        return flasks
    return None

def fills_for(rng, F, C, empties, coll_need=0, coll_color=None, fixed_empty=()):
    total = C * CAP + (coll_need - CAP if coll_color else 0)
    side = F
    fills = [0] * side
    slots = [i for i in range(side) if i not in fixed_empty]
    nonempty = slots[:]
    rng.shuffle(nonempty)
    empt = [i for i in nonempty if i not in fixed_empty][:max(0, empties - len(fixed_empty))]
    fillable = [i for i in slots if i not in empt]
    rem = total
    for i in fillable: fills[i] = 2
    rem -= 2 * len(fillable)
    if rem < 0: return None
    while rem > 0:
        c = [i for i in fillable if fills[i] < CAP]
        if not c: return None
        i = rng.choice(c); fills[i] += 1; rem -= 1
    return fills

WORLD_PARAMS = {
    # world: (colour range for normal levels, empty flasks, hidden fraction, workshop order size)
    0: ((4, 6), 1, 0.20, 2),
    1: ((6, 7), 1, 0.25, 3),
    2: ((7, 8), 1, 0.30, 3),
    3: ((8, 8), 0, 0.33, 3),
    4: ((8, 9), 0, 0.36, 4),
}

def mech(old):
    t = set(old.get('tags') or [])
    if old.get('workshopOrder'): t.add('workshop')
    if any(old.get('collector') or []): t.add('collector')
    if any(old.get('locked') or []): t.add('locked')
    if any(old.get('thawAfter') or []) or any(old.get('frozen') or []): t.add('frozen')
    if any(old.get('filterColor') or []): t.add('filter')
    if any(any(h) for h in (old.get('hidden') or [])): t.add('hidden')
    t.discard('emergency')
    return t

def build(idx, old, seed):
    rng = random.Random(seed)
    wi = min(4, idx // 20)
    (cmin, cmax), empties, hid_p, wsz = WORLD_PARAMS[wi]
    pos = (idx % 20) / 19.0
    C = cmin + int(round((cmax - cmin) * pos + rng.uniform(-0.4, 0.4)))
    C = max(cmin, min(cmax, C))
    if idx < 10: C = min(C, 4 + idx // 4)  # gentle start of the game
    t = mech(old)
    wsz = max(wsz, len(old.get('workshopOrder') or []))  # never fewer goals than before
    colors = PALETTE[:]; rng.shuffle(colors); colors = colors[:C]
    coll = 'collector' in t
    if coll:
        cc = colors[0]; need = 8
        C = max(5, C - 1 if wi < 2 else C); colors = colors[:C]
        F = C + 2 + (1 if wi < 1 else 0)   # side flasks; collector added at end
        fills = fills_for(rng, F, C, max(0, empties), need, cc)
        if not fills: return None
        flasks = deal(rng, colors, fills, cc, need)
        if not flasks: return None
        flasks.append([])
        n = len(flasks); caps = [4] * (n - 1) + [need]
        locked = [False] * n; lockColor = [None] * n; thaw = [0] * n; filt = [None] * n
        L = Lvl(flasks, caps, locked, lockColor, thaw, filt, n - 1, cc, need, None)
        extra = dict(collectorColor=cc, collectorNeed=need)
    else:
        F = C + 2
        fixed_empty = []
        locked = [False] * F; lockColor = [None] * F; thaw = [0] * F; filt = [None] * F
        if 'locked' in t:
            k = rng.randrange(F); fixed_empty.append(k); locked[k] = True
        if 'filter' in t:
            k = rng.choice([i for i in range(F) if i not in fixed_empty]); fixed_empty.append(k)
        fills = fills_for(rng, F, C, max(empties, len(fixed_empty)), fixed_empty=tuple(fixed_empty))
        if not fills: return None
        flasks = deal(rng, colors, fills)
        if not flasks: return None
        if 'locked' in t:
            k = [i for i in range(F) if locked[i]][0]
            # key colour: one that is not on top anywhere (must be dug out)
            tops = set(f[-1] for f in flasks if f)
            pick = [c for c in colors if c not in tops] or colors
            lockColor[k] = rng.choice(pick)
        if 'filter' in t:
            k = [i for i in fixed_empty if not locked[i]][0]
            filt[k] = rng.choice(colors)
        if 'frozen' in t:
            cand = [i for i in range(F) if len(flasks[i]) >= 3 and not locked[i] and not filt[i]]
            k = rng.choice(cand); thaw[k] = 1 if wi < 2 else 2
        order = None
        if 'workshop' in t:
            # most buried colours (lowest average height) are ordered
            depth = {}
            for f in flasks:
                for h, c in enumerate(f): depth.setdefault(c, []).append(h - len(f))
            order = sorted(colors, key=lambda c: (sum(depth[c]) / len(depth[c]), rng.random()))[:min(wsz, C - 1)]
        caps = [4] * F
        L = Lvl(flasks, caps, locked, lockColor, thaw, filt, None, None, 0, order)
        extra = dict(collectorColor=None, collectorNeed=0)
        if order: extra['workshopOrder'] = order
    sol, exp = solve(L, w=1.6, limit=250000)
    if sol is None:
        sol, exp = solve(L, w=3.0, limit=300000)
        if sol is None: return None
    # try to shorten with a tighter weight
    s2, e2 = solve(L, w=1.15, limit=200000)
    if s2 and len(s2) < len(sol): sol = s2
    n = len(flasks)
    hidden = []
    for f in flasks:
        hrow = [False] * len(f)
        for li in range(len(f) - 1):  # never hide the top layer
            if rng.random() < hid_p and 'hidden' in t: hrow[li] = True
        hidden.append(hrow)
    lvl = {
        'id': idx + 1, 'flasks': flasks, 'caps': caps, 'hidden': hidden,
        'locked': locked, 'lockColor': lockColor, 'thawAfter': thaw, 'frozen': [x > 0 for x in thaw],
        'mixer': [False] * n, 'collector': [i == L.ci for i in range(n)],
        'filterColor': filt, 'mixRecipe': [None] * n,
        'tags': sorted(t), **extra,
        'solutionLen': len(sol), 'hintPath': [list(m) for m in sol], 'states': exp,
        'validated': True, 'solutionMethod': 'astar_v470',
    }
    return lvl, exp

def difficulty_score(lvl):
    return lvl['solutionLen'] * 1.0 + math.log10(max(10, lvl['states'])) * 2

def work(args):
    idx, old = args
    best = None
    tries = 0; t0 = time.time()
    # several candidates, keep the hardest one (longest witness / largest search)
    want = 5 if idx >= 3 else 0
    seed = 470000 + idx * 1000
    while tries < 60 and (best is None or tries < want) and time.time() - t0 < 240:
        tries += 1; seed += 1
        r = build(idx, old, seed)
        if not r: continue
        lvl, exp = r
        if best is None or difficulty_score(lvl) > difficulty_score(best): best = lvl
    return idx, best

def main():
    pack = json.loads(PACK.read_text())
    levels = pack['levels']
    only = set(int(x) for x in sys.argv[1:]) if len(sys.argv) > 1 else None
    jobs = [(i, levels[i]) for i in range(3, len(levels)) if (only is None or (i + 1) in only)]
    out = {}
    with Pool(8) as p:
        for idx, lvl in p.imap_unordered(work, jobs):
            old = levels[idx]
            if not lvl:
                print('KEEP-OLD', idx + 1, flush=True); continue
            ratio = (old['moveLimit'] - old['solutionLen']) / max(1, old['solutionLen'])
            sl = lvl['solutionLen']
            spare = max(old['moveLimit'] - old['solutionLen'] if sl >= old['solutionLen'] else 0, math.ceil(ratio * sl), 2)
            lvl['moveLimit'] = sl + spare
            lvl['par'] = sl
            lvl['spareRatioOld'] = round(ratio, 3)
            out[idx] = lvl
            print('L%d C=%d F=%d sol=%d lim=%d (old sol %d lim %d) states=%d tags=%s' % (
                idx + 1, len(set(c for f in lvl['flasks'] for c in f)), len(lvl['flasks']), sl, lvl['moveLimit'],
                old['solutionLen'], old['moveLimit'], lvl['states'], ','.join(lvl['tags'])), flush=True)
    for idx, lvl in out.items(): levels[idx] = lvl
    PACK.write_text(json.dumps(pack, ensure_ascii=False, separators=(',', ':')))
    print('wrote', len(out))

if __name__ == '__main__':
    main()
