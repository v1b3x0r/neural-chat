import { drawerWithGestures } from '@nature-labs/uicp-adapter-vanilla';
import './styles.css';

const drawer = drawerWithGestures('#drawer', { position: 'left' });
document.querySelector('#drawer')!.innerHTML = '<h2>เชียงใหม่</h2><p>drawer works.</p>';
const app = document.querySelector('#app')!;
app.innerHTML = '<button id="menu">☰ open</button>';
app.querySelector('#menu')!.addEventListener('click', () => drawer.open());
document.querySelector('.backdrop')!.addEventListener('click', () => drawer.close());
