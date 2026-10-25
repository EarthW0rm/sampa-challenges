import { devConfig } from '../testConfig';
import { DaySim } from '../../game/sim/day';
import { check, checkEq, type Scenario } from '../harness';
import { Player, playDay } from '../player';
import { parseReplay, recordReplay, runReplay } from '../replay';

function played(seed: number) {
  const config = devConfig();
  const sim = new DaySim(config, seed);
  sim.startLog();
  playDay(sim, new Player());
  return { config, sim };
}

export const replay: Scenario[] = [
  {
    id: 'dia-completo-jogado-pelo-robo',
    rules: 'spec 5',
    run(seed) {
      const { sim } = played(seed);
      const r = sim.result()!;
      check(r.orders.served > 0, 'o robô atende clientes');
      check(r.revenue.total > 0, 'há receita');
      check(sim.commandLog().length > 20, 'registrou comandos');
    },
  },
  {
    id: 'replay-mesmo-hash-duas-vezes',
    rules: 'determinismo',
    run(seed) {
      const { config, sim } = played(seed);
      const rep = JSON.parse(JSON.stringify(recordReplay(config, seed, sim))) as unknown; // passa pelo JSON, como no arquivo
      const a = runReplay(parseReplay(rep));
      const b = runReplay(parseReplay(rep));
      checkEq(a, b, 'duas execuções iguais');
      checkEq(a, (rep as { hash: string }).hash, 'igual ao dia original');
    },
  },
  {
    id: 'replay-comando-diferente-muda-o-hash',
    rules: 'determinismo',
    run(seed) {
      const { config, sim } = played(seed);
      const rep = recordReplay(config, seed, sim);
      const alterado = { ...rep, comandos: rep.comandos.slice(5) };
      check(runReplay(alterado) !== rep.hash, 'sem os primeiros comandos o resultado muda');
    },
  },
  {
    id: 'replay-versao-antiga-recusada',
    rules: 'plan 5.3',
    run(seed) {
      const { config, sim } = played(seed);
      const rep = recordReplay(config, seed, sim);
      let msg = '';
      try {
        parseReplay({ ...rep, versao: 0 });
      } catch (e) {
        msg = e instanceof Error ? e.message : '';
      }
      check(msg.includes('versão 0'), `recusa com mensagem (obtido: ${msg})`);
      let bad = false;
      try {
        parseReplay(null);
      } catch {
        bad = true;
      }
      check(bad, 'lixo é recusado');
    },
  },
];
