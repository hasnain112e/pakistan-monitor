import { Panel } from './Panel';

// Stub registered by Task 0; Track B implements it in B3.
export class PakistanWeatherPanel extends Panel {
  constructor() {
    super({ id: 'pk-weather', title: 'Weather Warnings' });
    this.showLoading('Coming soon');
  }
}
export default PakistanWeatherPanel;
