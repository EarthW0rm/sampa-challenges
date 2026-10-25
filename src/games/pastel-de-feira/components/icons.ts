/** Imagens decorativas do DOM (HUD, Preparo, moldura): URLs com hash do build, carregadas com o jogo. */
import type { CSSProperties } from 'react';
import molduraUrl from '../assets/ui/moldura.png';

const HUD = import.meta.glob<string>('../assets/ui/hud_*.png', { eager: true, query: '?url', import: 'default' });
const ING = import.meta.glob<string>('../assets/itens/ing_*.png', { eager: true, query: '?url', import: 'default' });
const SABOR = import.meta.glob<string>('../assets/icones/sabor_*.png', { eager: true, query: '?url', import: 'default' });

/** Ícone do HUD (`moeda`, `fila`, `verao`, `som_off`…), 16×16 ampliado por CSS. */
export const hudIcon = (name: string): string | undefined => HUD[`../assets/ui/hud_${name}.png`];

/** Ícone do insumo (`carne`, `cana`…), 12×12 ampliado por CSS; `undefined` se não houver. */
export const ingIcon = (id: string): string | undefined => ING[`../assets/itens/ing_${id}.png`];

/** Selo do sabor da receita (base ou caldo), 12×12 ampliado por CSS; `undefined` se não houver. */
export const flavorIcon = (key: string): string | undefined => SABOR[`../assets/icones/sabor_${key}.png`];

/** Variável CSS da moldura de madeira 9-slice (`border-image` da classe `.moldura`). */
export const molduraVar = { '--pf-moldura': `url(${molduraUrl})` } as CSSProperties;
