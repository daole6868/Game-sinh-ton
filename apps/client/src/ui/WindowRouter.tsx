import { useStore } from '../state/store';
import { ContainerWindow } from './windows/ContainerWindow';
import { InventoryWindow } from './windows/InventoryWindow';
import { ContractsWindow, KeeperWindow, TravelWindow } from './windows/KeeperWindow';
import { MarketWindow } from './windows/MarketWindow';
import { AccountWindow, ForgeWindow, HelpWindow, LeaderboardWindow, MapWindow, StallWindow, TotemWindow } from './windows/MiscWindows';
import { ShopWindow } from './windows/ShopWindow';
import { TradeWindow } from './windows/TradeWindow';

export function WindowRouter() {
  const w = useStore((s) => s.window);
  const container = useStore((s) => s.container);
  const trade = useStore((s) => s.trade);
  if (trade) return <TradeWindow />;
  if (container) return <ContainerWindow />;
  if (!w) return null;
  switch (w.kind) {
    case 'inventory':
      return <InventoryWindow tab={w.tab} />;
    case 'shop':
      return <ShopWindow outpost={w.outpost} role={w.role} />;
    case 'market':
      return <MarketWindow outpost={w.outpost} />;
    case 'keeper':
      return <KeeperWindow outpost={w.outpost} />;
    case 'contracts':
      return <ContractsWindow outpost={w.outpost} />;
    case 'travel':
      return <TravelWindow outpost={w.outpost} />;
    case 'totem':
      return <TotemWindow tx={w.tx} ty={w.ty} />;
    case 'stall':
      return <StallWindow tx={w.tx} ty={w.ty} />;
    case 'forge':
      return <ForgeWindow tx={w.tx} ty={w.ty} />;
    case 'map':
      return <MapWindow />;
    case 'leaderboard':
      return <LeaderboardWindow />;
    case 'help':
      return <HelpWindow />;
    case 'account':
      return <AccountWindow />;
  }
}
