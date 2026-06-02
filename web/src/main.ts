import './styles.css';
import { initTheme } from './lib/theme';
import { mountChat } from './ui/chat';
import { mountDrawer } from './ui/drawer';

initTheme();
const drawer = mountDrawer(document.querySelector('#drawer') as HTMLElement);
mountChat(document.querySelector('#app') as HTMLElement, drawer.open);
