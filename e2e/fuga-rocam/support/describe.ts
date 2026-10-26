import { describer } from '../../support/describe';

/** Campos da Fuga da Rocam no cabeçalho das evidências (spec RN-33). Roda no navegador: autocontido. */
export const fugaDescriber = describer((w) => {
  type Cop = { cls: string; persona: string; tx: number; ty: number; stun: number; leaving: boolean; sees: boolean };
  type St = {
    map: string; phase: string; score: number; lives: number; stars: number; heat: number; deliveries: number;
    job: { kind: string; stage: string; pickup: number[]; drop: number[]; timeLeft: number | null } | null;
    itemList: { kind: string; tx: number; ty: number }[]; oil: number; shield: boolean; turbo: number; turboLocked: boolean;
    hidden: boolean; garageCd: number; invuln: number;
    player: { tx: number; ty: number; dir: number; off: number; x: number; y: number };
    copList: Cop[]; heliPos: { x: number; y: number } | null;
  };
  const h = (w as unknown as { __e2e?: { id: string; api: { state(): St } } | null }).__e2e;
  if (!h || h.id !== 'fuga-rocam') return [];
  const s = h.api.state();
  const dirs = ['→', '↓', '←', '↑'];
  const job = s.job
    ? `${s.job.kind} · ${s.job.stage === 'pickup' ? `buscar em (${s.job.pickup.join(', ')})` : `entregar em (${s.job.drop.join(', ')})`}${s.job.timeLeft !== null ? ` · ${s.job.timeLeft.toFixed(1)} s` : ''}`
    : 'aguardando';
  const cops = s.copList.map((c) => `${c.cls === 'car' ? 'carro' : 'moto'}/${c.persona} (${c.tx}, ${c.ty})${c.sees ? ' vendo' : ''}${c.stun > 0 ? ' parado' : ''}${c.leaving ? ' saindo' : ''}`);
  return [
    ['Partida', `mapa ${s.map} · fase ${s.phase} · ${s.score} pontos · ${s.lives} vidas · ${s.deliveries} entregas`],
    ['Procurado', `${s.stars} estrela(s) · calor ${s.heat.toFixed(1)}${s.hidden ? ' · escondido' : ''}${s.garageCd > 0 ? ` · garagens trancadas ${s.garageCd.toFixed(1)} s` : ''}`],
    ['Pedido', job],
    ['Jogador', `tile (${s.player.tx}, ${s.player.ty}) ${dirs[s.player.dir]} +${s.player.off.toFixed(1)} px · (${s.player.x.toFixed(1)}, ${s.player.y.toFixed(1)})${s.invuln > 0 ? ' · invulnerável' : ''}`],
    ['Recursos', `turbo ${(s.turbo * 100).toFixed(0)}%${s.turboLocked ? ' travado' : ''} · óleo ${s.oil} · escudo ${s.shield ? 'sim' : 'não'}`],
    ['Itens', s.itemList.length ? s.itemList.map((i) => `${i.kind} (${i.tx}, ${i.ty})`).join(', ') : 'nenhum'],
    ['Viaturas', (cops.length ? cops.join(', ') : 'nenhuma') + (s.heliPos ? ` + helicóptero (${s.heliPos.x.toFixed(0)}, ${s.heliPos.y.toFixed(0)})` : '')],
  ];
});
