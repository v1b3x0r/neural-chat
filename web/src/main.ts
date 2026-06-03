import './styles.css';
import { initTheme } from './lib/theme';
import { mountChat } from './ui/chat';
import { mountDrawer } from './ui/drawer';
import { mountMemoryPane } from './ui/debug';

initTheme();
const nav = mountDrawer(document.querySelector('#drawer') as HTMLElement);
const mem = mountMemoryPane(document.querySelector('#mem-drawer') as HTMLElement);
mountChat(document.querySelector('#app') as HTMLElement, nav.open, mem.open);
