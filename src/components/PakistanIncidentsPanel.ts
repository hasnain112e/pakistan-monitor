import { Panel } from './Panel';
import type { NewsItem } from '@/types';

// Stub registered by Task 0; Track A implements it in A4.
export class PakistanIncidentsPanel extends Panel {
  constructor(_getNews: () => NewsItem[], _focusMap: (lat: number, lon: number) => void) {
    super({ id: 'pk-incidents', title: 'Incidents' });
    this.showLoading('Coming soon');
  }
}
export default PakistanIncidentsPanel;
