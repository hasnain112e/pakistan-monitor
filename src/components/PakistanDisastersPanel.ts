import { Panel } from './Panel';

// Stub registered by Task 0; Track B implements it in B4.
export class PakistanDisastersPanel extends Panel {
  constructor() {
    super({ id: 'pk-disasters', title: 'Disasters' });
    this.showLoading('Coming soon');
  }
}
export default PakistanDisastersPanel;
