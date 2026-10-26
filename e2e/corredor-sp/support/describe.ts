import { describer } from '../../support/describe';

/** Campos do Corredor SP no cabeçalho das evidências (spec RN-32). Roda no navegador: autocontido. */
export const corredorDescriber = describer((w) => {
  type S = {
    phase: string;
    paused: boolean;
    countdown: number;
    track: string;
    model: { id: string };
    time: number;
    points: number;
    meters: number;
    packages: number;
    level: number;
    player: { x: number; kmh: number; lives: number; helmets: number; grau: number; grauOn: boolean; crashT: number; invul: number; boostT: number };
    rain: { on: boolean };
  };
  const h = (w as unknown as { __e2e?: { api: { state(): S } } | null }).__e2e;
  if (!h) return [];
  const s = h.api.state();
  const p = s.player;
  const lanes = [-0.85, -0.25, 0.25, 0.75];
  const corridors = [-0.55, 0, 0.5];
  let where: string;
  if (Math.abs(p.x) > 1.02) where = 'terra';
  else {
    const c = corridors.findIndex((k) => Math.abs(p.x - k) < 0.1);
    if (c === 0) where = 'faixa azul';
    else if (c > 0) where = `corredor ${c + 1}`;
    else {
      let best = 0;
      lanes.forEach((l, i) => {
        if (Math.abs(p.x - l) < Math.abs(p.x - lanes[best])) best = i;
      });
      where = `faixa ${best + 1}`;
    }
  }
  const fase = s.phase === 'countdown' ? `contagem (${Math.max(0, s.countdown).toFixed(1)} s)` : s.phase === 'racing' ? 'corrida' : 'fim de turno';
  const cond = p.crashT > 0 ? `caído (${p.crashT.toFixed(1)} s)` : p.invul > 0 ? `invulnerável (${p.invul.toFixed(1)} s)` : 'normal';
  return [
    ['Corrida', `${s.track} · ${s.model.id} · ${fase}${s.paused ? ' · PAUSADO' : ''}${s.rain.on ? ' · garoa' : ''}`],
    ['Placar', `${s.points} pontos · ${Math.floor(s.meters)} m · ${Math.floor(s.time)} s · ×${1 + s.packages} (${s.packages} pacotes)`],
    ['Moto', `vidas ${p.lives} · nível ${s.level} · ${Math.round(p.kmh)} km/h · x ${p.x.toFixed(2)} (${where})`],
    ['Grau/capacete', `grau ${Math.round(p.grau * 100)}%${p.grauOn ? ' LIGADO' : ''} · capacetes ${p.helmets}${p.boostT > 0 ? ` · turbo ${p.boostT.toFixed(1)} s` : ''} · ${cond}`],
  ];
});
