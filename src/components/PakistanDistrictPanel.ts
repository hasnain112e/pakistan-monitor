import { Panel } from './Panel';
import type { NewsItem } from '@/types';

// Stub registered by Task 0; Track A implements it in A3.
export class PakistanDistrictPanel extends Panel {
  constructor(_getNews: () => NewsItem[]) {
    super({ id: 'pk-district', title: 'District' });
    this.showLoading('Coming soon');
  }

  public showDistrict(_name: string): void {}
}
export default PakistanDistrictPanel;
