// Sprites em pixel art gerados por código. Cada personagem é um "look" (cores + estilo de cabelo,
// barba, arma) e o desenho é montado aqui. Para trocar por sprite sheets do Aseprite no futuro,
// basta substituir drawCharAt / drawDog mantendo a mesma assinatura.
import { ctx, R } from '../core/canvas';
import { G } from '../game/state';

type Col = (c: string) => string;

function drawHead(d: any, b: number, C: Col, o: any) {
  const y0 = -24 + b;
  R(C(d.skinS), -1, -17 + b, 3, 1);
  if (d.hs === 'mask') {
    R(C(d.hair), -5, y0 - 2, 10, 4); R(C(d.hair), -5, y0, 3, 8);
    R(C(d.skin), -2, y0 + 1, 6, 6); R(C(d.skinS), -2, y0 + 6, 6, 1); R(C('#9a9282'), 2, y0 + 2, 1, 3);
    return;
  }
  if (d.hs === 'helm') {
    R(C(d.hair), -4, y0 - 1, 8, 8); R(C('#6a707a'), -4, y0 - 1, 8, 1);
    R(C('#1a1c20'), 0, y0 + 3, 5, 1); R(d.eye, 3, y0 + 3, 1, 1); R(C('#4a4f58'), -4, y0 + 5, 1, 2);
    return;
  }
  R(C(d.skin), -3, y0, 7, 7);
  R(C(d.skinS), -3, y0 + 6, 2, 1);
  R(C(d.skinS), -1, y0 + 3, 1, 2);
  R(C(d.skin), 4, y0 + 3, 1, 2); R(C(d.skinS), 4, y0 + 4, 1, 1);
  R(C(d.skinS), 2, y0 + 5, 2, 1);
  const h = C(d.hair);
  switch (d.hs) {
    case 'wavy': R(h, -4, y0 - 2, 8, 3); R(h, -3, y0 - 3, 6, 1); R(h, -1, y0 - 4, 3, 1); R(h, -5, y0 - 1, 2, 5); R(h, -4, y0 + 1, 2, 4); R(h, 3, y0 - 1, 2, 2); R(h, 4, y0 + 1, 1, 1); break;
    case 'straight': R(h, -4, y0 - 1, 8, 2); R(h, -3, y0 - 2, 6, 1); R(h, -4, y0 + 1, 2, 4); R(h, 2, y0 + 1, 3, 1); break;
    case 'shortcurly': R(h, -3, y0 - 1, 7, 2); for (let i = -3; i < 4; i += 2) R(h, i, y0 - 2, 1, 1); R(h, -4, y0, 1, 3); R(h, -3, y0 + 1, 1, 2); break;
    case 'bigcurly': R(h, -5, y0 - 3, 10, 4); for (let i = -5; i < 5; i += 2) R(h, i, y0 - 4, 1, 1); R(h, -6, y0 - 2, 1, 4); R(h, -5, y0 + 1, 2, 3); R(h, 4, y0 - 2, 1, 2); R(h, 3, y0 + 1, 1, 1); break;
    case 'shadow': R(h, -4, y0 - 1, 8, 2); R(h, -3, y0 - 2, 6, 1); R(h, -4, y0 + 1, 2, 3); break;
    case 'bun': R(h, -4, y0 - 1, 8, 2); R(h, -6, y0 - 3, 3, 3); R(h, -4, y0 + 1, 2, 4); break;
    case 'hood': { const c = C(d.cape); R(c, -4, y0 - 2, 9, 3); R(c, -5, y0, 3, 8); R(c, 4, y0 - 1, 1, 2); R('rgba(0,0,0,.35)', -2, y0 + 1, 6, 2); break; }
    case 'bald': R(C(d.skinS), -3, y0, 7, 1); if (d.hair === '#bdbdbd') R(h, -3, y0 + 1, 2, 2); break;
  }
  if (d.hs !== 'hood') R(C(d.hair), 1, y0 + 2, 3, 1);
  R(C(o.eye || d.eye || '#1a1010'), 2, y0 + 3, 1, 1);
  switch (d.beard) {
    case 'full': R(h, -2, y0 + 4, 1, 2); R(h, -1, y0 + 5, 6, 2); R(h, 2, y0 + 4, 3, 1); R(C('#5a3028'), 2, y0 + 5, 2, 1); break;
    case 'mustache': R(h, 2, y0 + 4, 3, 1); break;
    case 'goatee': R(h, 2, y0 + 4, 3, 1); R(h, 1, y0 + 6, 3, 1); break;
    case 'stubble': R(C('rgba(40,25,20,.35)'), -1, y0 + 5, 6, 2); break;
  }
  if (d.glasses) { R(C('#151515'), -1, y0 + 3, 6, 1); R(C('#bcd7e6'), 1, y0 + 3, 3, 1); R(C('#111'), 2, y0 + 3, 1, 1); }
  if (d.hs === 'shadow') { R('rgba(0,0,0,.6)', -3, y0, 3, 7); R('rgba(0,0,0,.35)', 0, y0, 1, 7); }
}

function drawWeapon(w: string, C: Col) {
  switch (w) {
    case 'sword': R(C('#6b4a2a'), 0, 4, 1, 3); R(C('#b89a5a'), -2, 7, 5, 1); R(C('#c8ccd4'), 0, 8, 2, 12); R(C('#f2f4f8'), 0, 8, 1, 11); R(C('#c8ccd4'), 0, 20, 1, 1); break;
    case 'daggers': R(C('#b89a5a'), -1, 7, 3, 1); R(C('#d0d4dc'), 0, 8, 1, 7); R(C('#ffffff'), 0, 8, 1, 2); break;
    case 'axe': R(C('#5a3d22'), 0, 1, 1, 19); R(C('#8a8f98'), -5, 14, 5, 6); R(C('#d0d4dc'), -6, 15, 1, 4); R(C('#5a3d22'), -1, 19, 3, 1); break;
    case 'staff': R(C('#5a3d22'), 0, -3, 1, 22); R(C('#c9a24a'), -1, 17, 3, 1); R(C('#e8a33a'), -1, 18, 3, 3); R(C('#fff2b0'), 0, 19, 1, 1); break;
    case 'great': R(C('#3a3540'), -1, 4, 3, 2); R(C('#5a4a6a'), -3, 6, 7, 1); R(C('#2a2630'), -1, 7, 3, 17); R(C('#8a5ad0'), -1, 7, 1, 16); R(C('#2a2630'), 0, 24, 1, 1); break;
    case 'club': R(C('#5a4028'), 0, 3, 2, 10); R(C('#4a3420'), -1, 11, 4, 5); R(C('#2e2014'), -1, 15, 4, 1); break;
    case 'rusty': R(C('#6b5a40'), -2, 7, 5, 1); R(C('#8a7a66'), 0, 8, 2, 11); R(C('#6a5040'), 1, 12, 1, 3); break;
    case 'hammer': R(C('#3a2a1a'), 0, 0, 2, 22); R(C('#5a5560'), -5, 20, 12, 7); R(C('#7a7580'), -5, 20, 12, 2); R(C('#2a2630'), -5, 26, 12, 1); break;
    case 'bow': {
      const c = C('#7a5232');
      R(c, -7, 3, 1, 2); R(c, -6, 5, 1, 2); R(c, -5, 7, 2, 1); R(c, -3, 8, 6, 1); R(c, 3, 7, 2, 1); R(c, 5, 5, 1, 2); R(c, 6, 3, 1, 2);
      R(C('#cfc6b0'), -6, 3, 12, 1); break;
    }
    case 'cup': R(C('#e8e0d0'), -1, 5, 4, 4); R(C('#5a3418'), 0, 5, 2, 1); R(C('#e8e0d0'), 3, 6, 1, 2); break;
  }
}

function drawHumanoid(d: any, o: any) {
  const C: Col = c => (o.flash ? '#ffffff' : c);
  if (o.roll != null) {
    ctx.save(); ctx.translate(0, -7); ctx.rotate(o.roll);
    R(C(d.cape || d.outfitD), -7, -6, 14, 12); R(C(d.outfit), -6, -5, 12, 10); R(C(d.skin), 1, -5, 5, 4); R(C(d.hair), -2, -7, 8, 3);
    ctx.restore(); return;
  }
  const b = o.bob || 0, la = o.legA || 0;
  if (d.cape) { const f = Math.round(Math.sin(G.time * 4 + (o.seed || 0))); R(C(d.cape), -6, -16 + b, 3, 11 + f); R(C(d.cape), -7, -12 + b, 1, 8 + f); }
  R(C(d.pants), -3 - la, -7, 3, 5); R(C(d.boots), -3 - la, -2, 3, 2);
  R(C(d.outfitD), -3, -15 + b, 2, 6);
  R(C(d.outfit), -4, -16 + b, 8, 9); R(C(d.outfitD), -4, -16 + b, 1, 9); R(C(d.outfitD), -4, -9 + b, 8, 1);
  if (d.trim) R(C(d.trim), 2, -16 + b, 1, 7);
  R(C(d.pants), 0 + la, -7, 3, 5); R(C(d.boots), 0 + la, -2, 4, 2);
  if (d.robe) { R(C(d.outfit), -4, -8 + b, 8, 5); R(C(d.outfitD), -4, -4 + b, 8, 1); if (d.trim) R(C(d.trim), -4, -4 + b, 8, 1); }
  drawHead(d, b, C, o);
  if (d.chain) R(C(d.chain), 0, -16 + b, 3, 1);
  if (d.pendant) { R(C(d.pendant), 0, -16 + b, 3, 1); R(C(d.pendant), 2, -15 + b, 1, 4); }
  if (d.shield) {
    if (o.block) { R(C(d.shield), 3, -19 + b, 5, 12); R(C('#d4a84a'), 3, -19 + b, 5, 1); R(C('#d4a84a'), 5, -18 + b, 1, 11); }
    else { R(C(d.shield), -2, -15 + b, 5, 8); R(C(d.trim || '#7a7f88'), -2, -15 + b, 5, 1); R(C(d.trim || '#7a7f88'), 0, -14 + b, 1, 7); }
  }
  if (d.weapon === 'none') { R(C(d.outfit), 0, -15 + b, 2, 5); R(C(d.skin), 0, -10 + b, 2, 2); return; }
  ctx.save(); ctx.translate(1, -14 + b); ctx.rotate(o.armA ?? -.9);
  R(C(d.outfit), -1, 0, 3, 5); R(C(d.skin), -1, 5, 3, 2); if (d.bracelet) R(C('#d0d0d0'), -1, 4, 3, 1);
  drawWeapon(o.cup ? 'cup' : d.weapon, C);
  ctx.restore();
}

/** Desenha um humanoide com os pés em (x, y). face = 1 (direita) ou -1. */
export function drawCharAt(d: any, x: number, y: number, face: number, o: any, sc = 1, al = 1) {
  ctx.save(); ctx.globalAlpha = al; ctx.translate(Math.round(x), Math.round(y));
  if (!o.noShadow) { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(-6 * sc, -1, 12 * sc, 2); }
  ctx.scale(face * sc, sc);
  if (o.deadP) ctx.rotate(-Math.PI / 2 * o.deadP);
  drawHumanoid(d, o);
  ctx.restore();
}

/** Quadrúpedes (caramelo, lobo). pal = paleta do look. */
export function drawDog(e: any, pal: any) {
  ctx.save(); ctx.globalAlpha = e.alpha; ctx.translate(Math.round(e.x), Math.round(e.y));
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(-8, -1, 16, 2); ctx.scale(e.face, 1);
  const C: Col = c => (e.flash > 0 ? '#fff' : c);
  const run = e.state === 'chase' ? Math.sin(G.time * 22 + e.seed) : 0, leg = Math.round(run * 2), cr = e.state === 'wind' ? 2 : 0;
  if (e.state === 'dead') ctx.rotate(Math.min(1, e.t * 4) * -.4);
  const howl = e.state === 'howl';
  const wag = Math.round(Math.sin(G.time * 18));
  R(C(pal.dark), -10, -10 + cr + wag, 3, 2); R(C(pal.dark), -11, -12 + cr + wag, 2, 2);
  R(C(pal.dark), -6 + leg, -4, 2, 4); R(C(pal.dark), 4 - leg, -4, 2, 4); R(C(pal.mid), -4 - leg, -4, 2, 4); R(C(pal.mid), 6 + leg, -4, 2, 4);
  R(C(pal.body), -8, -10 + cr, 15, 6); R(C(pal.light), -5, -5 + cr, 10, 1);
  const hy = howl ? -4 : 0;
  R(C(pal.body), 5, -14 + cr + hy, 6, 6); R(C(pal.body), 10, -11 + cr + hy * 1.5, 3, 3); R(C('#1a1210'), 12, -11 + cr + hy * 1.5, 1, 1);
  R(C(pal.ear), 5, -16 + cr + hy, 2, 3); R(C(pal.eye), 8, -12 + cr + hy, 1, 1);
  if (e.state === 'atk' || e.state === 'wind') R(C('#fff'), 10, -9 + cr, 2, 1);
  ctx.restore();
}
