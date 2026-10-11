import { hasItems, ITEMS, makeStack, QUESTS, type QuestEvent } from '@suongdo/shared';
import { charWallet, SYS } from '../economy/ledger.ts';
import type { Game } from './game.ts';
import type { Player } from './player.ts';

type Ev =
  | { kind: 'have' }
  | Exclude<QuestEvent, { kind: 'have' } | { kind: 'kill' }>
  | { kind: 'kill'; mob?: string; count: number };

/** Xử lý một sự kiện có thể hoàn thành nhiệm vụ hiện tại. */
export function questEvent(game: Game, p: Player, ev: Ev): void {
  const q = QUESTS[p.quest.idx];
  if (!q || !p.alive) return;
  const g = q.goal;
  let done = false;
  switch (g.kind) {
    case 'have':
      done = hasItems(p.inv, g.items);
      break;
    case 'craft':
      done = ev.kind === 'craft' && ev.item === g.item;
      break;
    case 'place':
      done = ev.kind === 'place' && ev.structure === g.structure;
      break;
    case 'reach_ring':
      done = ev.kind === 'reach_ring' && ev.ring >= g.ring;
      break;
    case 'kill':
      if (ev.kind === 'kill' && (!g.mob || g.mob === ev.mob)) {
        p.stats.questKills += ev.count;
        p.quest.progress = `${Math.min(p.stats.questKills, g.count)}/${g.count}`;
        p.send({ t: 'quest', q: p.quest });
        done = p.stats.questKills >= g.count;
      }
      break;
    default:
      done = ev.kind === g.kind;
  }
  if (done) complete(game, p);
}

function complete(game: Game, p: Player): void {
  const q = QUESTS[p.quest.idx]!;
  try {
    game.atomic([p], () => {
      game.ledger.transfer(SYS.reward, charWallet(p.charId), q.reward, 'quest', q.id);
      p.quest = { idx: p.quest.idx + 1 };
      p.stats.questKills = 0;
    });
  } catch (e) {
    console.error('[quest]', e);
    return;
  }
  if (q.rewardItems) {
    for (const [id, n] of Object.entries(q.rewardItems)) {
      game.giveOrDrop(p, makeStack(id, n, { now: game.time, uid: () => game.uid() }));
    }
    game.invChanged(p);
  }
  game.refreshWallet(p);
  p.send({ t: 'quest', q: p.quest });
  const items = q.rewardItems ? ` + ${Object.entries(q.rewardItems).map(([id, n]) => `${ITEMS[id]?.name}×${n}`).join(', ')}` : '';
  game.note(p, `✔ Hoàn thành: ${q.title} (+${q.reward} Xu${items})`, 'good');
  // nhiệm vụ "có đủ đồ" kế tiếp có thể đã thỏa
  questEvent(game, p, { kind: 'have' });
}
